# Papermorph 视频课程

制作端使用 DozenTwelve/Papermorph，完成讲稿、配音、动画审核后，用它的 export.py 导出 MP4。系统的“视频讲解”接收成品，管理员可上传、编辑年级知识点、发布或归档。学生能播放、倍速、下载、断点续看及关联自己的错题。

管理员也可使用标准库发布脚本，课程默认为草稿，在网页审核后发布。

```powershell
python scripts/publish-papermorph.py lesson.mp4 --server http://你的站点 --email admin@example.com --title 鸡兔同笼 --grade 3
```

上传限制为100 MB，支持MP4；推荐H.264视频与AAC音频。文件按SHA256去重，保存在 `data/lesson-videos`，权限接口支持Range206，拖动进度和重听读取已保存成品。断点记录按账号和视频保存在设备上。

网页JSON备份包含课程元数据和个人错题关联，视频文件需备份整个 `data/lesson-videos` 目录。缺少媒体时恢复为草稿，重新上传相同MP4后可编辑发布。服务器发布流程同时备份媒体目录。

当前接入采用Papermorph制作与MP4发布流程。视频库不会自行启动模型写稿或在网页服务器渲染视频，生成工作在制作端进行。Papermorph源码为MIT，参考版本342e272648e06a6163224a6177bccc83517d7fea，项目地址 https://github.com/DozenTwelve/Papermorph 。成品内容版权随上传者提供的素材确定。
