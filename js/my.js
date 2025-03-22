var bywind = {
    hideTodayCard: function() {
        document.getElementById("todayCard") && document.getElementById("todayCard").classList.add("hide")
    }
}
$(".topGroup").hover((function() {}
), (function() {
        document.getElementById("todayCard").classList.remove("hide"),
        document.getElementById("todayCard").style.zIndex = 1
    }
))