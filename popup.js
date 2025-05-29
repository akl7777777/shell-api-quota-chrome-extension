console.log('=== popup.js 开始加载 ===');
console.log('当前时间:', new Date().toLocaleString());
console.log('浏览器信息:', navigator.userAgent);

// 检查Chrome API是否可用
if (typeof chrome !== 'undefined') {
    console.log('✅ Chrome API 可用');
    console.log('Chrome 版本:', chrome.runtime.getManifest());
} else {
    console.log('❌ Chrome API 不可用');
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded 事件触发');
    
    try {
        // 加载设置
        loadSettings();
        
        // 更新显示
        updateQuotaDisplay();
        
        // 绑定事件
        document.getElementById('saveBtn').addEventListener('click', saveSettings);
        document.getElementById('refreshBtn').addEventListener('click', refreshQuota);
        document.getElementById('testNotificationBtn').addEventListener('click', testNotification);
        
        console.log('事件绑定完成');
    } catch (error) {
        console.error('初始化失败:', error);
    }
});

// 加载保存的设置
function loadSettings() {
    try {
        chrome.storage.sync.get([
            'apiUrl', 
            'accessToken', 
            'threshold', 
            'checkInterval'
        ], function(result) {
            document.getElementById('apiUrl').value = result.apiUrl || '';
            document.getElementById('accessToken').value = result.accessToken || '';
            document.getElementById('threshold').value = result.threshold || '20';
            document.getElementById('checkInterval').value = result.checkInterval || '5';
            document.getElementById('thresholdDisplay').textContent = `$${result.threshold || '20'}`;
        });
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 保存设置
function saveSettings() {
    console.log('保存设置被调用');
    
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const accessToken = document.getElementById('accessToken').value.trim();
    const threshold = parseFloat(document.getElementById('threshold').value) || 20;
    const checkInterval = parseInt(document.getElementById('checkInterval').value) || 5;
    
    // 验证输入
    if (!apiUrl) {
        showMessage('请输入API地址', 'error');
        return;
    }
    
    if (!accessToken) {
        showMessage('请输入访问令牌', 'error');
        return;
    }
    
    // 保存到浏览器存储
    chrome.storage.sync.set({
        apiUrl,
        accessToken,
        threshold,
        checkInterval
    }, function() {
        // 更新显示
        document.getElementById('thresholdDisplay').textContent = `$${threshold}`;
        
        // 发送消息给background script重新设置定时器
        chrome.runtime.sendMessage({
            action: 'updateSettings',
            data: { apiUrl, accessToken, threshold, checkInterval }
        });
        
        showMessage('设置保存成功', 'success');
        
        // 立即检查一次余额
        refreshQuota();
    });
}

// 刷新余额
function refreshQuota() {
    console.log('刷新余额被调用');
    
    chrome.storage.sync.get(['apiUrl', 'accessToken'], function(result) {
        if (!result.apiUrl || !result.accessToken) {
            showMessage('请先配置API地址和访问令牌', 'error');
            return;
        }
        
        console.log('开始获取余额...');
        fetchQuota(result.apiUrl, result.accessToken)
            .then(function(quota) {
                console.log('获取到的余额:', quota);
                
                // 保存余额信息
                chrome.storage.local.set({
                    currentQuota: quota,
                    lastUpdate: new Date().toLocaleString()
                }, function() {
                    updateQuotaDisplay();
                    showMessage('余额刷新成功', 'success');
                });
            })
            .catch(function(error) {
                console.error('刷新余额失败:', error);
                showMessage('刷新失败: ' + error.message, 'error');
            });
    });
}

// 获取余额
function fetchQuota(apiUrl, accessToken) {
    // 使用正确的API端点
    const url = `${apiUrl}/api/user/self`;
    
    console.log('发送API请求:', url);
    
    return fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    })
    .then(function(response) {
        console.log('API响应状态:', response.status);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(function(data) {
        console.log('API响应数据:', data);
        
        // 检查API响应
        if (!data.success) {
            throw new Error(data.message || '获取余额失败');
        }
        
        // 根据API返回格式提取余额
        // 提取data.data.quota字段，并转换为更易读的形式
        const rawQuota = data.data.quota || 0;
        // 转换为美元 (500000 quota = 1 USD)
        const quota = rawQuota / 500000;
        
        console.log('解析的余额(美元):', quota);
        return quota;
    });
}

// 更新余额显示
function updateQuotaDisplay() {
    chrome.storage.local.get(['currentQuota', 'lastUpdate'], function(result) {
        chrome.storage.sync.get(['threshold'], function(settings) {
            const quota = result.currentQuota || 0;
            const threshold = settings.threshold || 20;
            const lastUpdate = result.lastUpdate || '从未更新';
            
            const quotaElement = document.getElementById('currentQuota');
            quotaElement.textContent = `$${quota.toFixed(2)}`;
            
            // 如果余额低于阈值，改变颜色
            if (quota <= threshold) {
                quotaElement.classList.add('quota-low');
            } else {
                quotaElement.classList.remove('quota-low');
            }
            
            document.getElementById('lastUpdate').textContent = lastUpdate;
        });
    });
}

// 显示消息
function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = type;
    
    // 3秒后清除消息
    setTimeout(function() {
        messageEl.textContent = '';
        messageEl.className = '';
    }, 3000);
}

// 测试通知功能
function testNotification() {
    console.log('测试通知函数被调用');
    
    // 尝试发送通知
    if ('Notification' in window) {
        Notification.requestPermission().then(function(permission) {
            if (permission === 'granted') {
                try {
                    // 通过background.js发送通知
                    chrome.runtime.sendMessage({
                        action: 'testNotification'
                    }, function(response) {
                        console.log('Background响应:', response);
                        showMessage('测试通知已发送', 'success');
                    });
                } catch (error) {
                    console.error('发送消息给background失败:', error);
                    
                    // 尝试直接发送通知
                    try {
                        new Notification('余额监控测试', {
                            body: '这是一条测试通知，如果您看到这条消息，说明通知功能正常工作！',
                            icon: 'icons/icon48.png'
                        });
                        showMessage('通知已发送', 'success');
                    } catch (notificationError) {
                        console.error('直接发送通知失败:', notificationError);
                        showMessage('通知发送失败: ' + notificationError.message, 'error');
                    }
                }
            } else {
                showMessage('请在浏览器设置中允许通知权限', 'error');
            }
        });
    } else {
        showMessage('您的浏览器不支持通知功能', 'error');
    }
} 