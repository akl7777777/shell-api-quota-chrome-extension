// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面已加载');
    
    // 获取按钮并添加事件监听器
    var button = document.getElementById('testButton');
    if (button) {
        button.addEventListener('click', function() {
            console.log('按钮被点击');
            alert('按钮被点击了！');
        });
        console.log('事件监听器已添加');
    } else {
        console.error('找不到按钮元素');
    }
});

// 立即执行的代码
console.log('脚本已加载'); 