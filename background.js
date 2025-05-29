// 定时器名称
const ALARM_NAME = 'quota-check';

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
    console.log('余额监控插件已安装');
    await setupAlarm();
    
    // 延迟5秒后执行首次检查
    setTimeout(() => {
        console.log('执行首次余额检查');
        checkAllSystemsQuota();
    }, 5000);
});

// 插件启动时初始化
chrome.runtime.onStartup.addListener(async () => {
    console.log('余额监控插件已启动');
    await setupAlarm();
    
    // 延迟5秒后执行首次检查
    setTimeout(() => {
        console.log('执行启动后余额检查');
        checkAllSystemsQuota();
    }, 5000);
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    if (message.action === 'updateSettings') {
        console.log('收到设置更新消息');
        setupAlarm()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('设置更新失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 异步响应
    } else if (message.action === 'updateSystems') {
        console.log('收到系统更新消息');
        setupAlarm()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('系统更新失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 异步响应
    } else if (message.action === 'forceCheckAll') {
        console.log('收到强制检查消息');
        forceCheckAllSystems()
            .then((result) => {
                console.log('强制检查启动成功:', result.message);
                sendResponse({ success: true, message: result.message });
            })
            .catch((error) => {
                console.error('强制检查启动失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 异步响应
    } else if (message.action === 'testNotification') {
        console.log('收到测试通知消息');
        sendTestNotification()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('发送测试通知失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 异步响应
    } else if (message.action === 'debugTimer') {
        console.log('收到调试定时器消息');
        debugTimerStatus()
            .then((result) => {
                sendResponse({ success: true, message: result });
            })
            .catch((error) => {
                console.error('调试定时器失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 异步响应
    } else {
        console.log('未知消息类型:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
});

// 监听定时器触发
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('定时检查余额触发');
        checkAllSystemsQuota();
    }
});

// 设置定时器
async function setupAlarm() {
    try {
        // 清除现有定时器
        await chrome.alarms.clear(ALARM_NAME);
        
        // 获取系统配置
        const result = await chrome.storage.sync.get(['systems']);
        const systems = result.systems || [];
        
        // 如果没有配置系统，则不设置定时器
        if (systems.length === 0) {
            console.log('没有配置系统，不设置定时器');
            return;
        }
        
        // 找出最小的检查间隔
        let minInterval = 60; // 默认最大60分钟
        systems.forEach(system => {
            const interval = system.checkInterval || 10;
            // 确保间隔不低于10分钟
            const safeInterval = interval < 10 ? 10 : interval;
            if (safeInterval < minInterval) {
                minInterval = safeInterval;
            }
        });
        
        // 创建新的定时器
        await chrome.alarms.create(ALARM_NAME, {
            delayInMinutes: 1, // 1分钟后首次检查
            periodInMinutes: minInterval
        });
        
        console.log(`定时器已设置，最小检查间隔: ${minInterval}分钟`);
    } catch (error) {
        console.error('设置定时器失败:', error);
    }
}

// 检查所有系统余额
async function checkAllSystemsQuota() {
    try {
        // 获取所有系统配置
        const result = await chrome.storage.sync.get(['systems']);
        const systems = result.systems || [];
        
        if (systems.length === 0) {
            console.log('没有配置系统，跳过检查');
            return;
        }
        
        console.log(`开始检查 ${systems.length} 个系统的余额`);
        
        // 获取当前时间，用于检查是否需要更新
        const now = new Date();
        
        // 检查每个系统
        for (const system of systems) {
            try {
                // 获取上次更新时间
                const quotaData = await chrome.storage.local.get(['systemsQuota']);
                const systemsQuota = quotaData.systemsQuota || {};
                const lastUpdateInfo = systemsQuota[system.id];
                
                // 如果有上次更新时间，检查是否需要更新
                if (lastUpdateInfo && lastUpdateInfo.lastUpdate) {
                    const lastUpdateTime = new Date(lastUpdateInfo.lastUpdate);
                    const diffMinutes = (now - lastUpdateTime) / (1000 * 60);
                    
                    // 确保检查间隔不低于10分钟
                    const safeInterval = system.checkInterval < 10 ? 10 : system.checkInterval;
                    
                    console.log(`系统 ${system.name}: 上次更新时间=${lastUpdateInfo.lastUpdate}, 间隔=${diffMinutes.toFixed(2)}分钟, 需要间隔=${safeInterval}分钟`);
                    
                    // 如果未达到检查间隔，则跳过
                    if (diffMinutes < safeInterval) {
                        console.log(`系统 ${system.name} 的检查间隔未到，跳过检查`);
                        continue;
                    }
                } else {
                    console.log(`系统 ${system.name} 没有上次更新记录，将进行检查`);
                }
                
                console.log(`检查系统 ${system.name} 的余额`);
                await checkSystemQuota(system);
                
                // 稍微延迟，避免同时发送太多请求
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`检查系统 ${system.name} 余额失败:`, error);
            }
        }
        
        // 更新图标徽章状态
        await updateBadgeStatus();
        
    } catch (error) {
        console.error('检查所有系统余额失败:', error);
    }
}

// 检查单个系统余额并发送通知
async function checkSystemQuota(system) {
    try {
        if (!system.apiUrl || !system.accessToken) {
            console.log(`系统 ${system.name} 的API设置未配置，跳过检查`);
            return;
        }
        
        // 获取当前余额
        const quota = await fetchQuota(system.apiUrl, system.accessToken, system.userId);
        const threshold = system.threshold || 20;
        
        // 保存余额信息
        const quotaData = await chrome.storage.local.get(['systemsQuota']);
        const systemsQuota = quotaData.systemsQuota || {};
        
        systemsQuota[system.id] = {
            quota: quota,
            lastUpdate: new Date().toISOString()
        };
        
        await chrome.storage.local.set({ systemsQuota });
        
        console.log(`系统 ${system.name} 当前余额: $${quota}, 阈值: $${threshold}`);
        
        // 检查是否需要通知
        if (quota <= threshold) {
            await sendLowBalanceNotification(system.name, quota, threshold);
        }
        
    } catch (error) {
        console.error(`检查系统 ${system.name} 余额失败:`, error);
        
        // 显示错误通知
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: `系统 ${system.name} 余额检查失败`,
            message: `错误: ${error.message}`
        });
    }
}

// 获取余额
async function fetchQuota(apiUrl, accessToken, userId) {
    const url = `${apiUrl}/api/user/self`;
    
    // 准备请求头
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };
    
    // 添加User ID请求头（如果提供了userId）
    if (userId) {
        // 支持多种格式的用户ID请求头
        headers['New-Api-User'] = userId;   // NewBingXMY格式
        headers['Rix-Api-User'] = userId;   // ShellAPI格式
        headers['Api-User'] = userId;       // 标准格式
        headers['X-Api-User'] = userId;     // X-前缀格式
        headers['User-Id'] = userId;        // 简单格式
        
        console.log(`添加了用户ID请求头: ${userId}`);
    }
    
    const response = await fetch(url, {
        method: 'GET',
        headers: headers
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
async function sendLowBalanceNotification(systemName, quota, threshold) {
    const notificationId = `low-balance-${systemName}-${Date.now()}`;
    
    await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `⚠️ ${systemName} Shell API 余额不足警告`,
        message: `当前余额 $${quota.toFixed(2)} 已低于设定阈值 $${threshold.toFixed(2)}，请及时充值！`,
        priority: 2
    });
    
    console.log(`已发送 ${systemName} 余额不足通知: $${quota} <= $${threshold}`);
}

// 更新插件图标徽章
async function updateBadgeStatus() {
    try {
        // 获取所有系统配置和余额
        const systemsConfig = await chrome.storage.sync.get(['systems']);
        const systems = systemsConfig.systems || [];
        
        const quotaData = await chrome.storage.local.get(['systemsQuota']);
        const systemsQuota = quotaData.systemsQuota || {};
        
        // 检查是否有任何系统余额低于阈值
        let lowBalanceSystems = 0;
        let lowBalanceDetails = [];
        
        for (const system of systems) {
            const quotaInfo = systemsQuota[system.id];
            if (quotaInfo && quotaInfo.quota <= system.threshold) {
                lowBalanceSystems++;
                lowBalanceDetails.push(`${system.name}: $${quotaInfo.quota.toFixed(2)}`);
            }
        }
        
        if (lowBalanceSystems > 0) {
            // 余额不足时显示警告
            await chrome.action.setBadgeText({ text: lowBalanceSystems.toString() });
            await chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
            await chrome.action.setTitle({ 
                title: `${lowBalanceSystems} 个系统余额不足:\n${lowBalanceDetails.join('\n')}` 
            });
        } else {
            // 余额充足时清除徽章
            await chrome.action.setBadgeText({ text: '' });
            await chrome.action.setTitle({ 
                title: `所有系统余额充足` 
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

// 强制检查所有系统（忽略时间间隔）
async function forceCheckAllSystems() {
    console.log('开始强制检查所有系统');
    
    try {
        // 获取所有系统配置
        const result = await chrome.storage.sync.get(['systems']);
        const systems = result.systems || [];
        
        if (systems.length === 0) {
            console.log('没有配置系统，跳过检查');
            return { message: '没有配置系统' };
        }
        
        console.log(`强制检查 ${systems.length} 个系统的余额`);
        
        // 启动后台检查进程，不等待完成
        performForceCheck(systems);
        
        // 立即返回，不等待所有检查完成
        return { message: `已启动 ${systems.length} 个系统的强制检查` };
        
    } catch (error) {
        console.error('强制检查所有系统余额失败:', error);
        throw error;
    }
}

// 执行实际的强制检查（在后台运行）
async function performForceCheck(systems) {
    try {
        console.log('开始执行后台强制检查');
        
        // 检查每个系统，无视时间间隔
        for (const system of systems) {
            try {
                console.log(`强制检查系统 ${system.name} 的余额`);
                try {
                    const quota = await fetchQuota(system.apiUrl, system.accessToken, system.userId);
                    // 更新余额数据
                    const quotaData = await chrome.storage.local.get(['systemsQuota']);
                    const systemsQuota = quotaData.systemsQuota || {};
                    
                    systemsQuota[system.id] = {
                        quota: quota,
                        lastUpdate: new Date().toISOString()
                    };
                    
                    await chrome.storage.local.set({ systemsQuota });
                    
                    console.log(`系统 ${system.name} 当前余额: $${quota}, 阈值: $${system.threshold}`);
                    
                    // 检查是否需要通知
                    if (quota <= system.threshold) {
                        await sendLowBalanceNotification(system.name, quota, system.threshold);
                    }
                    
                } catch (error) {
                    console.error(`强制检查系统 ${system.name} 余额失败:`, error);
                }
                
                // 稍微延迟，避免同时发送太多请求
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`强制检查系统 ${system.name} 余额失败:`, error);
            }
        }
        
        // 更新图标徽章状态
        await updateBadgeStatus();
        console.log('后台强制检查完成');
        
    } catch (error) {
        console.error('后台强制检查失败:', error);
    }
}

// 调试定时器状态
async function debugTimerStatus() {
    try {
        // 获取当前所有定时器
        const alarms = await chrome.alarms.getAll();
        console.log('所有定时器:', alarms);
        
        // 获取系统配置
        const result = await chrome.storage.sync.get(['systems']);
        const systems = result.systems || [];
        
        // 获取余额数据
        const quotaData = await chrome.storage.local.get(['systemsQuota']);
        const systemsQuota = quotaData.systemsQuota || {};
        
        let status = [];
        status.push(`已配置系统数量: ${systems.length}`);
        status.push(`当前定时器数量: ${alarms.length}`);
        
        if (alarms.length > 0) {
            const quotaAlarm = alarms.find(alarm => alarm.name === ALARM_NAME);
            if (quotaAlarm) {
                const nextRun = new Date(quotaAlarm.scheduledTime).toLocaleString();
                status.push(`余额检查定时器: 运行中`);
                status.push(`下次运行时间: ${nextRun}`);
                status.push(`运行间隔: ${quotaAlarm.periodInMinutes}分钟`);
            } else {
                status.push(`余额检查定时器: 未找到`);
            }
        } else {
            status.push(`没有活动的定时器`);
        }
        
        // 检查每个系统的最后更新时间
        if (systems.length > 0) {
            status.push('系统状态:');
            systems.forEach(system => {
                const quotaInfo = systemsQuota[system.id];
                if (quotaInfo) {
                    const lastUpdate = new Date(quotaInfo.lastUpdate).toLocaleString();
                    const userIdInfo = system.userId ? `UserID: ${system.userId}, ` : '';
                    status.push(`- ${system.name}: ${userIdInfo}最后更新 ${lastUpdate}, 余额 $${quotaInfo.quota.toFixed(2)}`);
                } else {
                    const userIdInfo = system.userId ? `UserID: ${system.userId}, ` : '';
                    status.push(`- ${system.name}: ${userIdInfo}从未更新`);
                }
            });
        }
        
        return status.join('\n');
        
    } catch (error) {
        console.error('获取定时器状态失败:', error);
        throw error;
    }
} 