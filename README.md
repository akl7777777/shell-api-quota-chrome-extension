# Shell API Monitor Extension

一个浏览器扩展，用于实时监控Shell API余额并在余额低时发送通知提醒。

## 功能特点

- 实时监控Shell API余额
- 自定义余额警告阈值
- 桌面通知提醒功能
- 可自定义检查间隔
- 简洁直观的用户界面

  <img width="561" alt="image" src="https://github.com/user-attachments/assets/b9a0de5c-da7e-4631-8fd0-97859f27f41a" />
![image](https://github.com/user-attachments/assets/ef3388f2-7dca-48d2-aa27-9577c5b8c4c8)
![image](https://github.com/user-attachments/assets/2abdb147-4d66-4432-ba90-fc7fbaa51380)


## 安装方法

### Chrome浏览器

1. 下载本项目代码
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目中的 `browser-extension` 文件夹

## 使用说明

1. 点击浏览器工具栏中的扩展图标
2. 配置API地址和访问令牌
3. 设置余额提醒阈值和检查间隔
4. 点击"保存配置"
5. 扩展将自动监控API余额，当余额低于阈值时发送通知

## 配置参数说明

- **API地址**: Shell API服务器地址，例如 `http://localhost:3000`
- **访问令牌**: 用于访问API的授权令牌
- **余额提醒阈值**: 当余额低于此值时触发通知提醒（美元）
- **检查间隔**: 检查余额的时间间隔（分钟）

## 技术说明

- 使用Chrome扩展API开发
- 余额计算采用 500,000 quota = 1 USD 的转换比例
- 支持后台自动检查和桌面通知
- 无需后端修改，仅使用现有API

## 许可证

MIT

## 作者

akl7777777

## 鸣谢

感谢所有为此项目做出贡献的人！ 
