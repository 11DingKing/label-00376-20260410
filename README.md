# Web Canvas 画板项目

## How to Run

```bash
# 使用 Docker Compose 一键启动
docker-compose up --build -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f
```

## Services

| 服务 | 端口 | 说明 |
|------|------|------|
| frontend-user | 8081 | 用户端画板应用 |

## 测试账号

暂无（本项目为纯前端画板应用，无需登录）

## 题目内容

基于 Vue 3 + TypeScript + Vite 实现的高级画板应用，采用混合渲染架构：**视觉层光栅化** + **逻辑层矢量化**。

### 核心功能

- **画笔绘制**：`source-over` 混合模式，支持压感，路径降采样优化
- **橡皮擦擦除**：`destination-out` 混合模式实现像素级擦除
- **笔迹切割**：胶囊体碰撞检测 + 二分交点精确切割
- **撤销/重做**：完整的历史记录管理

### 性能优化

- **空间网格索引**：50x50px 网格划分，加速碰撞检测
- **脏矩形渲染**：仅重绘变化区域
- **Web Worker**：后台线程执行切割计算
- **延迟计算**：mouseup 时才执行逻辑层切割
- **路径降采样**：< 2px 距离的点自动丢弃

### 访问地址

- 用户端：http://localhost:8081

---

## 项目结构

```
├── frontend-user/      # 用户端画板应用
│   ├── src/
│   │   ├── components/    # Vue 组件
│   │   ├── composables/   # 组合式函数
│   │   ├── utils/         # 工具函数（几何、切割、索引）
│   │   ├── workers/       # Web Worker
│   │   ├── styles/        # 样式
│   │   └── types/         # 类型定义
│   ├── Dockerfile         # Docker 构建文件
│   └── README.md          # 子项目说明
├── docker-compose.yml     # Docker Compose 配置
├── .gitignore             # Git 忽略文件
└── README.md              # 项目总说明
```

## 子项目说明

### frontend-user - 用户端

详见 [frontend-user/README.md](./frontend-user/README.md)

技术栈：Vue 3 + TypeScript + Vite + Canvas 2D API + Web Worker
