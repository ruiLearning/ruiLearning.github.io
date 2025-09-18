const API_URL = "https://ban-api-puce.vercel.app/api/tasks";
let tasks = [];

// 加载任务
async function loadTasks() {
  try {
    const res = await fetch(API_URL);
    tasks = await res.json();
    renderTasks();
  } catch (err) {
    console.error("加载任务失败:", err);
  }
}

// 渲染任务（按根任务分类）
function renderTasks() {
  const container = document.getElementById("task-list");
  if (!container) return;

  const rootTasks = tasks.filter(t => !t.parentId);

  const activeTasks = rootTasks.filter(t => !t.checked && !t.deleted);
  const completedTasks = rootTasks.filter(t => t.checked && !t.deleted);
  const deletedTasks = rootTasks.filter(t => t.deleted);

  container.innerHTML = `
    ${activeTasks.length ? '<h3>未完成</h3>' + renderTree(activeTasks) : ''}
    ${completedTasks.length ? '<h3>已完成</h3>' + renderTree(completedTasks) : ''}
    ${deletedTasks.length ? '<h3>已删除</h3>' + renderTree(deletedTasks) : ''}
  `;
}

// 递归渲染树
function renderTree(list) {
  if (!list || !list.length) return '';

  return `
    <ul>
      ${list.map(task => `
        <li>
          <div class="task-item ${task.deleted ? 'deleted' : ''}">
            <input type="checkbox" ${task.checked ? 'checked' : ''}
                   onchange="toggleTask('${task._id}', this.checked)">
            <input class="task-title" value="${task.title}"
                   onblur="editTask('${task._id}', this.value)">
            <div class="task-actions">
              ${task.deleted
                ? `<button onclick="restoreTask('${task._id}')">↩️</button>`
                : `<button onclick="softDeleteTask('${task._id}')">🗑</button>`}
              <button onclick="realDeleteTask('${task._id}')">❌</button>
              <button onclick="showSubTaskInput('${task._id}')">➕</button>
            </div>
            <div id="subtask-input-${task._id}" style="margin-left:30px;"></div>
          </div>
          ${renderTree(tasks.filter(t => t.parentId === task._id))}
        </li>
      `).join('')}
    </ul>
  `;
}

// 更新本地缓存和 API
async function updateTaskField(id, fields) {
  const task = tasks.find(t => t._id === id);
  if (task) Object.assign(task, fields);
  renderTasks();
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _id: id, ...fields })
  });
}

function toggleTask(id, checked) { return updateTaskField(id, { checked }); }
function editTask(id, title) { return updateTaskField(id, { title }); }
function softDeleteTask(id) { return updateTaskField(id, { deleted: true }); }
function restoreTask(id) { return updateTaskField(id, { deleted: false }); }

// 真实删除
async function realDeleteTask(id) {
// 先弹窗确认
  const ok = confirm("确定要删除这条任务吗？");
  if (!ok) return;

  // 1. 本地移除
  tasks = tasks.filter(t => t._id !== id);
  renderTasks();

  // 2. 调接口删除
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _id: id, action: "delete" })
    });
  } catch (err) {
    console.error("删除失败:", err);
    alert("删除失败，请重试");
  }
}

// 新增任务
async function addTask() {
  const input = document.getElementById("new-task-title");
  const title = input.value.trim();
  if (!title) return alert("请输入任务标题");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, parentId: null, level: 0 })
  });
  const data = await res.json();
  tasks.push({ _id: data._id, title, checked: false, deleted: false, parentId: null, level: 0 });
  input.value = '';
  renderTasks();
}

// 新增子任务
async function addSubTask(parentId) {
  const input = document.getElementById(`new-subtask-${parentId}`);
  const title = input.value.trim();
  if (!title) return alert("请输入子任务标题");

  const parent = tasks.find(t => t._id === parentId);
  const level = parent ? parent.level + 1 : 1;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, parentId, level })
  });
  const data = await res.json();

  tasks.push({ _id: data._id, title, checked: false, deleted: false, parentId, level });
  input.value = '';
  renderTasks();
}

// 显示子任务输入框
function showSubTaskInput(parentId) {
  const div = document.getElementById(`subtask-input-${parentId}`);
  if (div.innerHTML.trim()) return;
  div.innerHTML = `
    <input id="new-subtask-${parentId}" placeholder="子任务标题">
    <button onclick="addSubTask('${parentId}')">新增</button>
  `;
}

document.addEventListener("DOMContentLoaded", loadTasks);
