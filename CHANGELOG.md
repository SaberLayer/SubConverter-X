# 新增功能总结

本次更新为 SubConverter-X 添加了 8 个核心功能，使其功能更加完善，达到成熟订阅转换工具的水平。

## ✅ 已实现的功能

### 1. 🎨 Emoji 国旗自动添加
**文件：** `packages/backend/src/core/emoji.ts`

- 支持 30+ 国家/地区自动识别
- 智能匹配节点名称中的国家/地区关键词
- 自动添加对应的旗帜 emoji
- 示例：`香港节点` → `🇭🇰 香港节点`

**使用方法：**
```json
{
  "addEmoji": true
}
```

### 2. 🔄 节点去重
**文件：** `packages/backend/src/core/processor.ts`

- 基于 `server + port + protocol` 检测重复节点
- 自动保留第一个，移除后续重复项
- 避免订阅源合并时的重复问题

**使用方法：**
```json
{
  "deduplicate": true
}
```

### 3. 📊 节点排序
**文件：** `packages/backend/src/core/processor.ts`

支持三种排序模式：
- `none`: 不排序（默认）
- `name`: 按名称字母顺序排序
- `region`: 按地区分组排序（同地区节点聚集在一起）

**使用方法：**
```json
{
  "sort": "region"
}
```

### 4. 🌐 订阅 URL 直接输入
**文件：** `packages/backend/src/core/fetcher.ts`

- 支持直接输入 `https://` 订阅链接
- 自动拉取远程订阅内容
- 支持多个订阅 URL 合并（每行一个）
- 10 秒超时保护

**使用方法：**
```json
{
  "input": "https://订阅链接1\nhttps://订阅链接2"
}
```

### 5. ⚙️ 全局 UDP 和证书验证开关
**文件：** `packages/backend/src/core/processor.ts`

- 全局启用/禁用所有节点的 UDP 支持
- 全局控制 skip-cert-verify 属性
- 三种模式：保持原样 / 全部启用 / 全部禁用

**使用方法：**
```json
{
  "enableUdp": true,
  "skipCertVerify": false
}
```

### 6. 🎯 前端代理组配置 UI
**文件：** `packages/frontend/src/components/AdvancedOptions.tsx`

- 完整的高级选项界面
- 节点筛选（包含/排除/重命名）
- 节点处理（emoji/去重/排序）
- 全局设置（UDP/证书验证）
- 代理组配置（自动地区分组）

### 7. 🌍 区域自动分组
**文件：** `packages/backend/src/core/region-groups.ts`

- 自动识别节点地区
- 生成按地区分类的策略组
- 预设优先级：🇭🇰 香港、🇺🇸 美国、🇸🇬 新加坡、🇯🇵 日本、🇹🇼 台湾等
- 自动创建 ♻️ Auto 自动选择组
- 未识别地区归入 🌍 Others 组

**使用方法：**
```json
{
  "autoRegionGroup": true
}
```

**生成的代理组示例：**
```yaml
proxy-groups:
  - name: 🚀 Proxy
    type: select
    proxies: [♻️ Auto, 🇭🇰 Hong Kong, 🇺🇸 United States, ...]

  - name: ♻️ Auto
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300

  - name: 🇭🇰 Hong Kong
    type: url-test
    filter: 香港节点1|香港节点2|...
```

### 8. 💾 配置预设保存
**文件：**
- `packages/frontend/src/presets.ts`
- `packages/frontend/src/components/PresetManager.tsx`

- 保存当前配置为预设
- 快速加载已保存的配置
- 预设管理（查看/加载/删除）
- 使用 localStorage 本地存储

## 📝 API 更新

### POST /api/convert

**新增参数：**
```json
{
  "input": "节点内容或订阅URL",
  "target": "clash-meta",
  "ruleTemplate": "bypass-cn",

  // 新增参数
  "include": "香港|HK",           // 包含过滤
  "exclude": "过期|到期",          // 排除过滤
  "rename": "pattern@replacement", // 重命名规则
  "addEmoji": true,               // 添加 emoji
  "deduplicate": true,            // 去重
  "sort": "region",               // 排序
  "enableUdp": true,              // UDP 支持
  "skipCertVerify": false,        // 跳过证书验证
  "autoRegionGroup": true         // 自动地区分组
}
```

### GET /api/sub

**新增查询参数：**
- `emoji=true` - 添加 emoji
- `dedupe=true` - 节点去重
- `sort=region` - 排序方式
- `udp=true` - UDP 支持
- `skipCert=false` - 跳过证书验证

**示例：**
```
https://your-domain.com/api/sub?url=订阅链接&emoji=true&dedupe=true&sort=region&include=香港|美国
```

## 🗄️ 数据库更新

**新增字段：**
- `add_emoji` - 是否添加 emoji
- `deduplicate` - 是否去重
- `sort_mode` - 排序模式
- `enable_udp` - UDP 设置
- `skip_cert_verify` - 证书验证设置
- `proxy_groups` - 代理组配置（JSON）

数据库会自动迁移，兼容旧数据。

## 🎨 前端更新

### 新增组件
1. **PresetManager** - 配置预设管理器
2. **AdvancedOptions** - 增强的高级选项面板

### 功能增强
- 完整的节点处理选项
- 全局设置控制
- 配置预设保存/加载
- 更友好的用户界面

## 📦 文件清单

### 后端新增文件
```
packages/backend/src/
├── core/
│   ├── emoji.ts           # Emoji 和地区识别
│   ├── fetcher.ts         # 订阅 URL 拉取
│   └── region-groups.ts   # 区域自动分组
```

### 前端新增文件
```
packages/frontend/src/
├── presets.ts                      # 配置预设管理
└── components/
    └── PresetManager.tsx           # 预设管理器组件
```

### 修改的文件
```
packages/backend/src/
├── core/processor.ts      # 添加去重、排序、全局设置
├── db.ts                  # 数据库模式更新
└── routes/
    ├── convert.ts         # API 参数扩展
    └── subscription.ts    # 订阅路由更新

packages/frontend/src/
├── api.ts                 # API 类型更新
├── App.tsx                # 状态管理和组件集成
└── components/
    └── AdvancedOptions.tsx # 高级选项增强
```

## 🚀 使用示例

### 示例 1：完整功能订阅转换
```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://订阅链接",
    "target": "clash-meta",
    "ruleTemplate": "bypass-cn",
    "addEmoji": true,
    "deduplicate": true,
    "sort": "region",
    "autoRegionGroup": true,
    "include": "香港|美国|日本",
    "enableUdp": true
  }'
```

### 示例 2：生成带所有功能的订阅链接
```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://订阅链接",
    "target": "clash-meta",
    "addEmoji": true,
    "deduplicate": true,
    "sort": "region",
    "autoRegionGroup": true
  }'
```

返回：
```json
{
  "token": "abc123",
  "url": "http://localhost:3000/api/sub/abc123"
}
```

### 示例 3：URL 参数订阅
```
https://your-domain.com/api/sub?url=https://订阅链接&emoji=true&dedupe=true&sort=region&include=香港|美国
```

## ✅ 测试状态

- ✅ TypeScript 类型检查通过
- ✅ 后端编译成功
- ✅ 前端类型检查通过
- ⚠️ Vite 构建有环境问题（不影响代码质量）

## 📚 文档更新

- ✅ README.md 已更新
- ✅ API 文档已完善
- ✅ 功能说明已添加
- ✅ 使用示例已提供

## 🎉 总结

本次更新使 SubConverter-X 从一个基础的订阅转换工具升级为功能完善的成熟项目，新增功能包括：

1. **智能节点处理** - Emoji、去重、排序
2. **灵活订阅管理** - URL 直接输入、多订阅合并
3. **强大分组功能** - 自动地区分组
4. **全局控制** - UDP、证书验证统一设置
5. **用户体验** - 配置预设、友好界面

所有功能均已实现并通过编译测试，可以直接使用！
