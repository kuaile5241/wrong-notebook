# 彩色家庭学习版

维护仓库：https://github.com/kuaile5241/wrong-notebook 。原有 MIT 许可与作者署名保留。

## 界面

晴空蓝与蓝紫色作为主色，配合薄荷绿、珊瑚色和暖杏色；导航、学科卡片、知识点标签增加彩色提示。题目为蓝色，正确答案为绿色，我的作答为珊瑚色，解析为紫色，错因为暖黄色。录入、校对、预览与详情沿用同一组语义颜色，并保留文字标签；支持深色模式、移动端与减少动画偏好。打印正文保留原布局。

## 安卓在线客户端

- 包名：`com.kuaile5241.wrongnotebook`；显示名称：彩虹错题本。
- 默认连接本实例，构建时可用 `-PclientServerUrl=https://your-domain.example` 覆盖。
- 不内置服务器与用户数据，不包含账号、密码或 AI Key；数据仍在服务器。
- 每次启动获取在线网页，服务器发布页面与功能修复后，重新打开 App 即生效，无需重装。此机制需要联网；原生外壳能力变化仍需安装同签名的新 APK。
- 保留拍照/相册上传、下载、打印和更换服务器功能。手机版竖屏，平板版支持系统旋转。
- 发布包使用本地持久签名密钥，密钥和密码不入 Git；必须备份密钥才能持续覆盖升级。
- 标准构建沿用 `scripts/package/build.mjs android --mode client`；已有 Windows SDK/JDK 可用 `packaging/android/build-client.ps1`，参数见脚本。

## 独立容器更新

`packaging/Dockerfile.family` 可从已验证的运行镜像构建本仓库源码；通过 `RUNTIME_IMAGE` 传入固定 digest，设置 `FAMILY_REVISION` 与 `FAMILY_VERSION`。构建阶段执行 lint、全量 Vitest、数据库初始化及生产构建，数据库只用于生成干净的新安装模板。

部署前使用 SQLite backup API 一致性备份真实数据库，保存设置、环境和 Compose；只替换本应用镜像，原数据挂载、端口和资源限制保留。新应用使用 `PRESERVE_EXISTING_DATA=true`，仅增量迁移。失败时恢复原 Compose 与对应的一致性备份。不得重启其他网站或 Docker 守护进程。

英语词汇新增独立媒体只读挂载，词汇进度随SQLite与原备份保存，见[词汇模块](VOCABULARY.md)。
