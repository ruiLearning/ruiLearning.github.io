// === 接口配置 ===
const API_CONFIG = {
  task: "https://ban-api-puce.vercel.app/api/tasks",
  fit: "https://ban-api-puce.vercel.app/api/banFits",
};

// 每个列表维护独立的数据
const allTasks = {
  task: [],
  fit: []
};

// 加载任务
async function loadTasks(listId) {
  try {
    const res = await fetch(API_CONFIG[listId]);
    allTasks[listId] = await res.json();
    renderTasks(listId);
  } catch (err) {
    console.error(`加载 ${listId} 失败:`, err);
  }
}

// 渲染任务
function renderTasks(listId) {
  const container = document.getElementById(`task-list-${listId}`);
  if (!container) return;

  const tasks = allTasks[listId];
  const rootTasks = tasks.filter(t => !t.parentId);
  const activeTasks = rootTasks.filter(t => !t.checked && !t.deleted);
  const completedTasks = rootTasks.filter(t => t.checked && !t.deleted);
  const deletedTasks = rootTasks.filter(t => t.deleted);

  container.innerHTML = `
    ${activeTasks.length ? '<h3>未完成</h3>' + renderTree(activeTasks, listId) : ''}
    ${completedTasks.length ? '<h3>已完成</h3>' + renderTree(completedTasks, listId) : ''}
    ${deletedTasks.length ? '<h3>已删除</h3>' + renderTree(deletedTasks, listId) : ''}
  `;
}

// 递归渲染树
function renderTree(list, listId, parentDeleted = false) {
  if (!list || !list.length) return '';

  return `
    <ul>
      ${list.map(task => {
        const isDeleted = parentDeleted || task.deleted; // 若父级被删除，子级也视为删除
        return `
          <li>
            <div class="task-item ${isDeleted ? 'deleted' : ''}">
              <input type="checkbox" ${task.checked ? 'checked' : ''}
                     onchange="toggleTask('${task._id}', this.checked, '${listId}')">
              <input class="task-title" value="${task.title}"
                     onblur="editTask('${task._id}', this.value, '${listId}')">
              <div class="task-actions">
                ${task.deleted
                  ? `<button onclick="restoreTask('${task._id}', '${listId}')">↩️</button>`
                  : `<button onclick="softDeleteTask('${task._id}', '${listId}')">🗑</button>`}
                <button onclick="realDeleteTask('${task._id}', '${listId}')">❌</button>
                <button onclick="showSubTaskInput('${task._id}', '${listId}')">➕</button>
              </div>
              <div id="subtask-input-${task._id}" style="margin-left:30px;"></div>
            </div>
            ${renderTree(allTasks[listId].filter(t => t.parentId === task._id), listId, isDeleted)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}


// 更新本地缓存和 API
async function updateTaskField(id, fields, listId) {
  const task = allTasks[listId].find(t => t._id === id);
  if (task) Object.assign(task, fields);
  renderTasks(listId);

  await fetch(API_CONFIG[listId], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _id: id, ...fields })
  });
}

// 操作函数
function toggleTask(id, checked, listId) { return updateTaskField(id, { checked }, listId); }
function editTask(id, title, listId) { return updateTaskField(id, { title }, listId); }
function softDeleteTask(id, listId) { return updateTaskField(id, { deleted: true }, listId); }
function restoreTask(id, listId) { return updateTaskField(id, { deleted: false }, listId); }

// 真实删除（支持删除子任务）
async function realDeleteTask(id, listId) {
  if (!confirm("确定要删除这条任务及其所有子任务吗？")) return;

  // 获取所有需要删除的任务，包括子任务
  const getAllChildrenIds = (parentId) => {
    const children = allTasks[listId].filter(t => t.parentId === parentId);
    let ids = children.map(c => c._id);
    for (const c of children) {
      ids = ids.concat(getAllChildrenIds(c._id));
    }
    return ids;
  };

  const allIdsToDelete = [id, ...getAllChildrenIds(id)];

  // 从本地缓存删除
  allTasks[listId] = allTasks[listId].filter(t => !allIdsToDelete.includes(t._id));
  renderTasks(listId);

  // 发送删除请求
  try {
    for (const delId of allIdsToDelete) {
      await fetch(API_CONFIG[listId], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: delId, action: "delete" })
      });
    }
    console.log(`✅ 已删除 ${allIdsToDelete.length} 条任务`);
  } catch (err) {
    console.error("删除失败:", err);
    alert("删除失败，请重试");
  }
}


// 新增任务
async function addTask(listId) {
  const input = document.getElementById(`new-task-title-${listId}`);
  const title = input.value.trim();
  if (!title) return alert("请输入任务标题");

  const res = await fetch(API_CONFIG[listId], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, parentId: null, level: 0 })
  });
  const data = await res.json();
  allTasks[listId].push({ _id: data._id, title, checked: false, deleted: false, parentId: null, level: 0 });
  input.value = '';
  renderTasks(listId);
}

// 新增子任务
async function addSubTask(parentId, listId) {
  const input = document.getElementById(`new-subtask-${parentId}`);
  const title = input.value.trim();
  if (!title) return alert("请输入子任务标题");

  const parent = allTasks[listId].find(t => t._id === parentId);
  const level = parent ? parent.level + 1 : 1;

  const res = await fetch(API_CONFIG[listId], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, parentId, level })
  });
  const data = await res.json();
  allTasks[listId].push({ _id: data._id, title, checked: false, deleted: false, parentId, level });
  input.value = '';
  renderTasks(listId);
}

// 显示子任务输入框
function showSubTaskInput(parentId, listId) {
  const div = document.getElementById(`subtask-input-${parentId}`);
  if (div.innerHTML.trim()) return;
  div.innerHTML = `
    <input id="new-subtask-${parentId}" placeholder="子任务标题">
    <button onclick="addSubTask('${parentId}', '${listId}')">新增</button>
  `;
}

// 页面里有任务清单时才请求接口（其他页面不再白白多发两个请求）；
// 站内用 pjax 切换页面时不会触发 DOMContentLoaded，所以切换完成后也初始化一次
function initTaskLists() {
  ['task', 'fit'].forEach(id => {
    if (document.getElementById(`task-list-${id}`)) loadTasks(id);
  });
}
document.addEventListener("DOMContentLoaded", initTaskLists);
document.addEventListener("pjax:complete", initTaskLists);


// === 一键导入30天健身计划（父子结构）===
const fitnessPlan = [
  { date: '⏰10/27', time: '早上 7:00', type: '🏃‍♂️ 跑步', duration: '慢跑 30 分钟（轻松呼吸）', notes: '早餐高蛋白，晚餐清淡，睡眠 7–8h' },
  { date: '⏰10/28', time: '晚上 21:00', type: '🔥 跳绳', duration: '间歇跳绳 15 分钟 ×2组，间隔1分钟', notes: '多喝水，少油炸食品' },
  { date: '⏰10/29', time: '休息', type: '—', duration: '—', notes: '保证深度睡眠，适量拉伸' },
  { date: '⏰10/30', time: '早上 6:30', type: '🧗‍♂️ 爬楼梯', duration: '2 组 × 10 层，慢速', notes: '早餐蔬菜+蛋白，睡前少咖啡因' },
  { date: '⏰10/31', time: '早上 7:00', type: '🚴‍♂️ 骑行', duration: '30 分钟沿江绿道，轻松速度', notes: '补充水分，晚餐少碳水' },
  { date: '⏰11/1', time: '休息', type: '—', duration: '—', notes: '放松、拉伸、早睡' },
  { date: '⏰11/2', time: '休息', type: '—', duration: '—', notes: '放松、拉伸、早睡' },
  { date: '⏰11/3', time: '休息', type: '—', duration: '—', notes: '放松、拉伸、早睡' },
  { date: '⏰11/4', time: '早上 7:00', type: '🏃‍♂️ 跑步', duration: '35 分钟慢跑', notes: '早餐加燕麦，保持水分' },
  { date: '⏰11/5', time: '晚上 21:00', type: '🔥 跳绳+🧗‍♂️ 楼梯', duration: '跳绳 15 分钟，爬楼梯 1 组 × 12 层', notes: '晚餐蛋白适量，睡前拉伸' },
  { date: '⏰11/6', time: '休息', type: '—', duration: '—', notes: '放松肌肉，保证睡眠' },
  { date: '⏰11/7', time: '早上 6:30', type: '🚴‍♂️ 骑行', duration: '35 分钟，适度加速', notes: '早餐蛋白+水果，晚餐清淡' },
  { date: '⏰11/8', time: '晚上 21:00', type: '🏃‍♂️ 跑步', duration: '30 分钟慢跑 + 5 分钟冲刺', notes: '水分充足，睡前拉伸' },
  { date: '⏰11/9', time: '休息', type: '—', duration: '—', notes: '放松与补水' },
  { date: '⏰11/10', time: '早上 7:00', type: '🔥 跳绳', duration: '间歇跳绳 20 分钟 ×2组', notes: '早餐蛋白+复合碳水' },
  { date: '⏰11/11', time: '晚上 21:00', type: '🧗‍♂️ 爬楼梯', duration: '2–3 组 × 12 层', notes: '晚餐少盐，保证睡眠' },
  { date: '⏰11/12', time: '早上 6:30', type: '🚴‍♂️ 骑行', duration: '40 分钟', notes: '早餐加蛋白，睡眠 7–8h' },
  { date: '⏰11/13', time: '晚上 21:00', type: '🏃‍♂️ 跑步', duration: '35 分钟慢跑 + 5 分钟冲刺', notes: '水分充足，晚餐清淡' },
  { date: '⏰11/14', time: '休息', type: '—', duration: '—', notes: '放松肌肉，适当拉伸' },
  { date: '⏰11/15', time: '早上 7:00', type: '🔥 跳绳+🧗‍♂️ 爬楼梯', duration: '跳绳 15 分钟 + 爬楼梯 2 组 × 15 层', notes: '早餐高蛋白，晚餐清淡' },
  { date: '⏰11/16', time: '早上 6:30', type: '🚴‍♂️ 骑行', duration: '40 分钟，适度加速', notes: '水果补充维生素' },
  { date: '⏰11/17', time: '休息', type: '—', duration: '—', notes: '放松肌肉，深度睡眠' },
  { date: '⏰11/18', time: '早上 7:00', type: '🏃‍♂️ 跑步', duration: '40 分钟慢跑 + 5 分钟冲刺', notes: '早餐蛋白+复合碳水' },
  { date: '⏰11/19', time: '晚上 21:00', type: '🔥 跳绳', duration: '间歇跳绳 20 分钟 ×2组', notes: '补充水分，拉伸' },
  { date: '⏰11/20', time: '休息', type: '—', duration: '—', notes: '放松肌肉，保证睡眠' },
  { date: '⏰11/21', time: '早上 7:00', type: '🧗‍♂️ 爬楼梯', duration: '3 组 × 15 层', notes: '早餐高蛋白' },
  { date: '⏰11/22', time: '晚上 21:00', type: '🏃‍♂️ 跑步+🔥 跳绳', duration: '跑步 20 分钟 + 跳绳 20 分钟', notes: '晚餐清淡' },
  { date: '⏰11/23', time: '休息', type: '—', duration: '—', notes: '适当拉伸，保证睡眠' },
  { date: '⏰11/24', time: '早上 6:30', type: '🚴‍♂️ 骑行', duration: '45 分钟，适度加速', notes: '早餐高蛋白' },
  { date: '⏰11/25', time: '晚上 21:00', type: '🧗‍♂️ 爬楼梯+🔥 跳绳', duration: '爬楼梯 3 组 × 15 层 + 跳绳 20 分钟', notes: '补充水分，晚餐清淡' },
  { date: '⏰11/26', time: '休息', type: '—', duration: '—', notes: '放松肌肉，保证睡眠' },
  { date: '⏰11/27', time: '早上 7:00', type: '🏃‍♂️ 跑步', duration: '45 分钟慢跑 + 冲刺 5 分钟', notes: '早餐高蛋白' },
  { date: '⏰11/28', time: '晚上 21:00', type: '🔥 跳绳+🏃‍♂️ 跑步', duration: '跳绳 25 分钟 + 跑步 25 分钟', notes: '水分充足，睡眠 7–8h' },
  { date: '⏰11/29', time: '早上 6:30', type: '🚴‍♂️ 骑行', duration: '50 分钟', notes: '早餐蛋白+水果' },
  { date: '⏰11/30', time: '晚上 21:00', type: '🧗‍♂️ 爬楼梯+🏃‍♂️ 跑步', duration: '爬楼梯 3 组 × 15 层 + 跑步 20 分钟', notes: '晚餐清淡' }
];


async function importFitnessPlan() {
  let success = 0;

  for (let plan of fitnessPlan) {
    try {
      // 1级：日期
      const res = await fetch(API_CONFIG.fit, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: plan.date, parentId: null, level: 0 }),
      });
      const data = await res.json();
      const parentId = data._id;

      // 2级：时间、运动、饮食
      const children = [
        { title: `时间: ${plan.time}` },
        { title: `运动类型: ${plan.type} / ${plan.duration}` },
        { title: `饮食 & 睡眠: ${plan.notes}` }
      ];

      for (const child of children) {
        const childRes = await fetch(API_CONFIG.fit, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: child.title, parentId, level: 1 }),
        });
        const childData = await childRes.json();
        allTasks.fit.push({ _id: childData._id, title: child.title, checked: false, deleted: false, parentId, level: 1 });
      }

      // 添加父级到本地缓存
      allTasks.fit.push({ _id: parentId, title: plan.date, checked: false, deleted: false, parentId: null, level: 0 });

      success++;
      console.log(`✅ 已导入: ${plan.date} (${success}/${fitnessPlan.length})`);

    } catch (err) {
      console.error("❌ 导入失败:", plan.date, err);
    }
  }

  renderTasks('fit');
  alert(`🎉 导入完成！成功导入 ${success} 条日期计划。`);
}


// importFitnessPlan();