// 定时器名称
const ALARM_NAME = 'quota-check';

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
    console.log('余额监控插件已安装');
    await setupAlarm();
});

// 插件启动时初始化
chrome.runtime.onStartup.addListener(async () => {
    console.log('余额监控插件已启动');
    await setupAlarm();
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateSettings') {
        console.log('收到设置更新消息');
        setupAlarm().then(() => {
            sendResponse({ success: true });
        });
        return true; // 异步响应
    } else if (message.action === 'testNotification') {
        console.log('收到测试通知消息');
        sendTestNotification().then(() => {
            sendResponse({ success: true });
        });
        return true; // 异步响应
    }
});

// 监听定时器触发
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('定时检查余额触发');
        checkQuotaAndNotify();
    }
});

// 设置定时器
async function setupAlarm() {
    try {
        // 清除现有定时器
        await chrome.alarms.clear(ALARM_NAME);
        
        // 获取检查间隔设置
        const result = await chrome.storage.sync.get(['checkInterval']);
        const intervalMinutes = result.checkInterval || 5;
        
        // 创建新的定时器
        await chrome.alarms.create(ALARM_NAME, {
            delayInMinutes: 1, // 1分钟后首次检查
            periodInMinutes: intervalMinutes
        });
        
        console.log(`定时器已设置，检查间隔: ${intervalMinutes}分钟`);
    } catch (error) {
        console.error('设置定时器失败:', error);
    }
}

// 检查余额并发送通知
async function checkQuotaAndNotify() {
    try {
        // 获取设置
        const settings = await chrome.storage.sync.get([
            'apiUrl', 
            'accessToken', 
            'threshold'
        ]);
        
        if (!settings.apiUrl || !settings.accessToken) {
            console.log('API设置未配置，跳过检查');
            return;
        }
        
        // 获取当前余额
        const quota = await fetchQuota(settings.apiUrl, settings.accessToken);
        const threshold = settings.threshold || 20;
        
        // 保存余额信息
        await chrome.storage.local.set({
            currentQuota: quota,
            lastUpdate: new Date().toLocaleString()
        });
        
        console.log(`当前余额: $${quota}, 阈值: $${threshold}`);
        
        // 检查是否需要通知
        if (quota <= threshold) {
            await sendLowBalanceNotification(quota, threshold);
        }
        
        // 更新插件图标（可选）
        await updateBadge(quota, threshold);
        
    } catch (error) {
        console.error('检查余额失败:', error);
        
        // 显示错误通知
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: '余额检查失败',
            message: `错误: ${error.message}`
        });
    }
}

// 获取余额
async function fetchQuota(apiUrl, accessToken) {
    const url = `${apiUrl}/api/user/self`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
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
}

// 发送余额不足通知
async function sendLowBalanceNotification(quota, threshold) {
    const notificationId = `low-balance-${Date.now()}`;
    
    await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '⚠️ Shell API 余额不足警告',
        message: `当前余额 $${quota.toFixed(2)} 已低于设定阈值 $${threshold.toFixed(2)}，请及时充值！`,
        priority: 2
    });
    
    console.log(`已发送余额不足通知: $${quota} <= $${threshold}`);
}

// 更新插件图标徽章
async function updateBadge(quota, threshold) {
    try {
        if (quota <= threshold) {
            // 余额不足时显示警告
            await chrome.action.setBadgeText({ text: '!' });
            await chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
            await chrome.action.setTitle({ 
                title: `余额不足: $${quota.toFixed(2)} <= $${threshold.toFixed(2)}` 
            });
        } else {
            // 余额充足时清除徽章
            await chrome.action.setBadgeText({ text: '' });
            await chrome.action.setTitle({ 
                title: `当前余额: $${quota.toFixed(2)}` 
            });
        }
    } catch (error) {
        console.error('更新图标徽章失败:', error);
    }
}

// 发送测试通知
async function sendTestNotification() {
    try {
        console.log('发送测试通知...');
        
        const notificationId = `test-${Date.now()}`;
        
        // 尝试创建通知
        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Shell API 余额监控测试',
            message: '如果您看到这条消息，说明通知功能正常工作！',
            priority: 2,
            requireInteraction: true  // 要求用户交互才消失
        });
        
        console.log('通知已发送，ID:', notificationId);
        
        return { success: true, notificationId };
        
    } catch (error) {
        console.error('发送测试通知失败:', error);
        throw error;
    }
} 