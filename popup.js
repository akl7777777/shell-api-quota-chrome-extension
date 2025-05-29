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
        // 加载系统列表
        loadSystems();
        
        // 绑定事件
        document.getElementById('addSystemBtn').addEventListener('click', showAddSystemForm);
        document.getElementById('saveBtn').addEventListener('click', saveSystem);
        document.getElementById('cancelBtn').addEventListener('click', hideSystemForm);
        document.getElementById('refreshAllBtn').addEventListener('click', refreshAllSystems);
        document.getElementById('forceCheckBtn').addEventListener('click', forceCheckAll);
        document.getElementById('testNotificationBtn').addEventListener('click', testNotification);
        
        console.log('事件绑定完成');
    } catch (error) {
        console.error('初始化失败:', error);
    }
});

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 加载系统列表
function loadSystems() {
    try {
        chrome.storage.sync.get(['systems'], function(result) {
            const systems = result.systems || [];
            
            // 如果没有系统记录，但有旧版配置，则转换为新格式
            if (systems.length === 0) {
                chrome.storage.sync.get(['apiUrl', 'accessToken', 'threshold', 'checkInterval'], function(oldConfig) {
                    if (oldConfig.apiUrl && oldConfig.accessToken) {
                        const defaultSystem = {
                            id: generateId(),
                            name: '默认系统',
                            apiUrl: oldConfig.apiUrl,
                            accessToken: oldConfig.accessToken,
                            threshold: oldConfig.threshold || 20,
                            checkInterval: oldConfig.checkInterval || 5
                        };
                        
                        systems.push(defaultSystem);
                        chrome.storage.sync.set({ systems });
                        renderSystemsList(systems);
                        
                        // 迁移完成后，清除旧配置
                        chrome.storage.sync.remove(['apiUrl', 'accessToken', 'threshold', 'checkInterval']);
                    } else {
                        renderSystemsList(systems);
                    }
                });
            } else {
                renderSystemsList(systems);
            }
        });
    } catch (error) {
        console.error('加载系统列表失败:', error);
    }
}

// 渲染系统列表
function renderSystemsList(systems) {
    const systemsList = document.getElementById('systemsList');
    systemsList.innerHTML = '';
    
    if (systems.length === 0) {
        systemsList.innerHTML = '<div class="system-item">尚未配置任何系统，请点击"添加新系统"按钮开始配置。</div>';
        return;
    }
    
    systems.forEach(function(system) {
        const systemElement = document.createElement('div');
        systemElement.className = 'system-item';
        systemElement.id = `system-${system.id}`;
        
        const systemHTML = `
            <div class="system-header">
                <span class="system-name">${system.name}</span>
                <div class="action-buttons">
                    <button class="action-button edit-button" data-id="${system.id}">编辑</button>
                    <button class="action-button delete-button" data-id="${system.id}">删除</button>
                    <button class="action-button refresh-button" data-id="${system.id}">刷新</button>
                </div>
            </div>
            <div class="system-balance">
                <span>当前余额:</span>
                <span class="quota-value" id="quota-${system.id}">--</span>
            </div>
            <div class="system-balance">
                <span>提醒阈值:</span>
                <span>$${system.threshold}</span>
            </div>
            <div class="system-balance">
                <span>最后更新:</span>
                <span id="lastUpdate-${system.id}">--</span>
            </div>
        `;
        
        systemElement.innerHTML = systemHTML;
        systemsList.appendChild(systemElement);
        
        // 绑定事件
        systemElement.querySelector('.edit-button').addEventListener('click', function() {
            editSystem(system.id);
        });
        
        systemElement.querySelector('.delete-button').addEventListener('click', function() {
            deleteSystem(system.id);
        });
        
        systemElement.querySelector('.refresh-button').addEventListener('click', function() {
            refreshSystem(system.id);
        });
        
        // 获取该系统的余额
        updateSystemQuotaDisplay(system.id);
    });
}

// 显示添加系统表单
function showAddSystemForm() {
    // 清空表单
    document.getElementById('systemName').value = '';
    document.getElementById('apiUrl').value = '';
    document.getElementById('accessToken').value = '';
    document.getElementById('threshold').value = '20';
    document.getElementById('checkInterval').value = '10';
    document.getElementById('systemId').value = '';
    
    // 更新表单标题
    document.getElementById('formTitle').textContent = '添加系统';
    
    // 显示表单
    document.getElementById('systemForm').style.display = 'block';
}

// 隐藏系统表单
function hideSystemForm() {
    document.getElementById('systemForm').style.display = 'none';
}

// 编辑系统
function editSystem(systemId) {
    chrome.storage.sync.get(['systems'], function(result) {
        const systems = result.systems || [];
        const system = systems.find(s => s.id === systemId);
        
        if (system) {
            // 填充表单
            document.getElementById('systemName').value = system.name;
            document.getElementById('apiUrl').value = system.apiUrl;
            document.getElementById('accessToken').value = system.accessToken;
            document.getElementById('threshold').value = system.threshold;
            document.getElementById('checkInterval').value = system.checkInterval;
            document.getElementById('systemId').value = system.id;
            
            // 更新表单标题
            document.getElementById('formTitle').textContent = '编辑系统';
            
            // 显示表单
            document.getElementById('systemForm').style.display = 'block';
        }
    });
}

// 删除系统
function deleteSystem(systemId) {
    if (confirm('确定要删除此系统吗？此操作不可撤销。')) {
        chrome.storage.sync.get(['systems'], function(result) {
            let systems = result.systems || [];
            systems = systems.filter(s => s.id !== systemId);
            
            chrome.storage.sync.set({ systems }, function() {
                // 更新UI
                renderSystemsList(systems);
                showMessage('系统已删除', 'success');
                
                // 通知后台更新监控
                chrome.runtime.sendMessage({
                    action: 'updateSystems',
                    data: { systems }
                });
            });
        });
    }
}

// 保存系统配置
function saveSystem() {
    const systemId = document.getElementById('systemId').value;
    const name = document.getElementById('systemName').value.trim();
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const accessToken = document.getElementById('accessToken').value.trim();
    const threshold = parseFloat(document.getElementById('threshold').value) || 20;
    let checkInterval = parseInt(document.getElementById('checkInterval').value) || 10;
    
    // 确保检查间隔不低于10分钟
    if (checkInterval < 10) {
        checkInterval = 10;
        document.getElementById('checkInterval').value = '10';
        showMessage('检查间隔已调整为最小值10分钟', 'error');
    }
    
    // 验证输入
    if (!name) {
        showMessage('请输入系统名称', 'error');
        return;
    }
    
    if (!apiUrl) {
        showMessage('请输入API地址', 'error');
        return;
    }
    
    if (!accessToken) {
        showMessage('请输入访问令牌', 'error');
        return;
    }
    
    chrome.storage.sync.get(['systems'], function(result) {
        let systems = result.systems || [];
        
        if (systemId) {
            // 更新现有系统
            const index = systems.findIndex(s => s.id === systemId);
            if (index !== -1) {
                systems[index] = {
                    id: systemId,
                    name,
                    apiUrl,
                    accessToken,
                    threshold,
                    checkInterval
                };
            }
        } else {
            // 添加新系统
            systems.push({
                id: generateId(),
                name,
                apiUrl,
                accessToken,
                threshold,
                checkInterval
            });
        }
        
        // 保存到浏览器存储
        chrome.storage.sync.set({ systems }, function() {
            // 隐藏表单
            hideSystemForm();
            
            // 更新UI
            renderSystemsList(systems);
            
            // 显示成功消息
            showMessage('系统配置已保存', 'success');
            
            // 通知后台更新监控
            chrome.runtime.sendMessage({
                action: 'updateSystems',
                data: { systems }
            });
            
            // 立即刷新所有系统余额
            refreshAllSystems();
        });
    });
}

// 刷新单个系统余额
function refreshSystem(systemId) {
    console.log(`刷新系统 ${systemId} 余额`);
    
    chrome.storage.sync.get(['systems'], function(result) {
        const systems = result.systems || [];
        const system = systems.find(s => s.id === systemId);
        
        if (!system) {
            showMessage('系统不存在', 'error');
            return;
        }
        
        const quotaElement = document.getElementById(`quota-${systemId}`);
        if (quotaElement) {
            quotaElement.textContent = '加载中...';
        }
        
        fetchQuota(system.apiUrl, system.accessToken)
            .then(function(quota) {
                console.log(`系统 ${system.name} 余额:`, quota);
                
                // 保存余额信息
                chrome.storage.local.get(['systemsQuota'], function(data) {
                    const systemsQuota = data.systemsQuota || {};
                    
                    systemsQuota[systemId] = {
                        quota: quota,
                        lastUpdate: new Date().toISOString()
                    };
                    
                    chrome.storage.local.set({ systemsQuota }, function() {
                        updateSystemQuotaDisplay(systemId);
                        showMessage(`${system.name} 余额刷新成功`, 'success');
                    });
                });
            })
            .catch(function(error) {
                console.error(`刷新 ${system.name} 余额失败:`, error);
                showMessage(`刷新 ${system.name} 失败: ${error.message}`, 'error');
                
                const quotaElement = document.getElementById(`quota-${systemId}`);
                if (quotaElement) {
                    quotaElement.textContent = '获取失败';
                }
            });
    });
}

// 刷新所有系统余额
function refreshAllSystems() {
    console.log('刷新所有系统余额');
    
    chrome.storage.sync.get(['systems'], function(result) {
        const systems = result.systems || [];
        
        if (systems.length === 0) {
            showMessage('尚未配置任何系统', 'error');
            return;
        }
        
        showMessage('开始刷新所有系统...', 'success');
        
        // 依次刷新每个系统
        systems.forEach(function(system) {
            setTimeout(function() {
                refreshSystem(system.id);
            }, 500); // 稍微错开请求时间
        });
    });
}

// 强制检查所有系统（用于调试）
function forceCheckAll() {
    console.log('强制检查所有系统');
    
    showMessage('开始强制检查所有系统...', 'success');
    
    // 发送消息给background script
    chrome.runtime.sendMessage({
        action: 'forceCheckAll'
    }, function(response) {
        console.log('强制检查响应:', response);
        
        if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            showMessage('通信失败: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        
        if (response && response.message) {
            showMessage(response.message, 'success');
            // 延迟一段时间后刷新显示，让后台检查有时间完成
            setTimeout(() => {
                loadSystems();
            }, 3000);
        } else {
            showMessage('强制检查失败: ' + (response ? response.error : '未知错误'), 'error');
        }
    });
}

// 更新系统余额显示
function updateSystemQuotaDisplay(systemId) {
    chrome.storage.local.get(['systemsQuota'], function(data) {
        const systemsQuota = data.systemsQuota || {};
        const quotaInfo = systemsQuota[systemId];
        
        if (!quotaInfo) {
            return;
        }
        
        chrome.storage.sync.get(['systems'], function(result) {
            const systems = result.systems || [];
            const system = systems.find(s => s.id === systemId);
            
            if (!system) {
                return;
            }
            
            const quota = quotaInfo.quota || 0;
            const threshold = system.threshold || 20;
            const lastUpdate = quotaInfo.lastUpdate ? new Date(quotaInfo.lastUpdate).toLocaleString() : '从未更新';
            
            const quotaElement = document.getElementById(`quota-${systemId}`);
            if (quotaElement) {
                quotaElement.textContent = `$${quota.toFixed(2)}`;
                
                // 如果余额低于阈值，改变颜色
                if (quota <= threshold) {
                    quotaElement.classList.add('quota-low');
                } else {
                    quotaElement.classList.remove('quota-low');
                }
            }
            
            const lastUpdateElement = document.getElementById(`lastUpdate-${systemId}`);
            if (lastUpdateElement) {
                lastUpdateElement.textContent = lastUpdate;
            }
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