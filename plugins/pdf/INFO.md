---
id: pdf
name: PDF 与压缩
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: null
routes_prefix: /api/plugin/pdf
summary: PDF 合并/分割/压缩 · 批量压缩
icon: 📄
entries: [pdf, batch]
tables: []
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# PDF 与压缩 信息卡

## 职责
PDF 合并/分割/压缩 · 批量压缩

## 入口与路由
- entry：pdf、batch
- 后端路由：/api/plugin/pdf

## 数据表
- 无业务表

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
