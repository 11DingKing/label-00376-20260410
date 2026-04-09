# Web Canvas 高级画板 - 用户端

基于 Vue 3 + TypeScript + Vite 实现的混合渲染架构画板。

## 功能

- **画笔**：`source-over` 绘制，路径降采样
- **橡皮擦**：`destination-out` 像素级擦除
- **笔迹切割**：胶囊体碰撞 + 二分交点精确切割
- **性能优化**：空间网格索引、Web Worker 后台切割
- **Toast 提示**：工具切换、清空画布提示
- **现代化 UI**：深色工具栏、浅色画布

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 测试

```bash
npm run test          # 单次运行
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率
```

## Docker 构建

```bash
docker build -t frontend-user .
docker run -p 8081:80 frontend-user
```
