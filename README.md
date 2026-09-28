# 冰封纪要 - 极地冰芯钻探全栈系统

极地冰芯钻探队的综合数据采集与分析平台，实现语音采集、声学补偿、智能转写、说话人识别、摘要生成与卫星通信的全链路解决方案。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端 (React)                        │
│  ┌───────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ 深度图表  │  │ 气泡成分图  │  │ 钻探日志与摘要   │   │
│  └───────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────────┘
                              │ REST API
┌─────────────────────────────▼───────────────────────────┐
│                    后端 (FastAPI)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 音频采集 │  │ librosa  │  │ Whisper  │  │ pyannote │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ OpenAI   │  │ 铱星链路 │  │ 数据存储 │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

## 主要功能

### 后端模块
1. **音频采集模块** - 在低温低气压环境下采集语音数据
2. **librosa声学补偿** - 针对高海拔环境的声学特性补偿
3. **Whisper转写** - 语音转文字，年代推断和气候事件识别
4. **pyannote说话人标记** - 区分工程师和气候学家
5. **OpenAI摘要生成** - 钻探日志摘要与样品分配方案
6. **铱星链路通信** - 定时邮件回传功能

### 前端模块
1. **冰层深度图表** - 可视化钻探深度与冰芯参数
2. **气泡成分图表** - 展示冰芯气泡中的气体成分分析
3. **钻探日志** - 显示转写内容、说话人标记与AI摘要

## 快速开始

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python main.py          # http://localhost:8000
```

### 前端启动

```bash
cd frontend
npm install
npm run dev             # http://localhost:3000，/api 代理到 8000
```

### 测试

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
```

## 环境变量

配置 `.env` 文件：

```
OPENAI_API_KEY=your_api_key
PYANNOTE_AUTH_TOKEN=your_token
IRIDIUM_EMAIL=satellite@email.com
TEMPERATURE_CELSIUS=-40
ALTITUDE_METERS=3500
ICE_CORE_DB_PATH=            # 可选，覆盖默认 sqlite 路径
ICE_CORE_AUDIO_DIR=          # 可选，覆盖默认音频落盘目录
```

### 离线运行说明

`requirements.txt` 只包含轻量依赖。Whisper、pyannote、librosa、soundfile、OpenAI SDK 与
apscheduler 属**可选**重型依赖（见 `requirements-ml.txt`）。未安装模型、未配置 Key 时，
转写 / 说话人 / 摘要 / 定时传输都会走确定性的离线分支，因此后端与 `pytest` 能在无网络、无 GPU、
不调用任何外部 API 的环境下跑通。请保持这条离线分支可用。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | 服务状态 |
| POST | `/api/audio/upload` | 上传音频（multipart，字段 `file`） |
| POST | `/api/audio/process/{audio_id}` | 声学补偿 + 转写 + 说话人标记，落库日志 |
| POST | `/api/logs/{log_id}/summarize` | 生成摘要与样品分配方案 |
| GET | `/api/logs` | 日志列表（`limit`） |
| GET | `/api/logs/{log_id}` | 日志详情 |
| POST | `/api/logs/{log_id}/transmit` | 通过铱星链路传输日志 |
| GET | `/api/depth-series` | 深度序列（`log_id`、`limit`） |
| POST | `/api/depth-series` | 新增深度记录 |
| GET | `/api/transmission/pending` | 待传输日志 |
| GET | `/api/transmission/history` | 传输历史（含失败尝试） |
| POST | `/api/speaker/reset` | 重置说话人档案 |
| GET | `/api/speaker/profiles` | 说话人档案汇总 |

## 行为规格（验收标准）

本节是本次修复的唯一验收依据，逐条以本节为准。

### A. 输入校验与错误响应

1. `POST /api/audio/upload` 只接受扩展名属于白名单 `wav`、`mp3`、`m4a`、`flac`、`aac`
   （大小写不敏感）的音频文件。未提供文件、文件名为空、或扩展名不在白名单时，必须返回 `400`
   并带 JSON 错误体；白名单内返回 `200`，响应体包含非空 `audio_id` 与 `status`。
2. `POST /api/depth-series` 的请求体非法时必须返回 `400`：类型错误（例如用 `"abc"` 表示数值）、
   缺少必填字段、以及 `depth_meters`、`bubble_density`、`co2_concentration`、
   `methane_concentration`、`dust_concentration`、`estimated_age`（若给出）为负数。
   `ice_temperature` 允许为负（冰层温度本就为负）。非法请求不得写入数据库；
   合法请求返回 `200`，且该记录可通过 `GET /api/depth-series` 读回。

### B. 年代推断与气候事件

3. 年代推断不得对同一处表述重复计数：当一条表述同时命中多条年龄模式、且命中的数字跨度完全相同
   （例如「距今12000年前」）时，`estimate_age_from_text` 只返回一条记录，
   `process_transcript` 的 `age_mentions` 中也不得出现同一跨度被计两次。
4. 气候事件关键词匹配必须大小写不敏感：`co2`/`CO2`、`ch4`/`CH4` 必须等价，
   英文关键字不得因为大小写差异而被漏检。

### C. 说话人角色判定

5. 角色判定必须确定：当某说话人累计的 `engineer` 与 `climatologist` 评分相等时，
   `_get_speaker_role` 与 `get_speaker_summary` 必须返回 `unknown`，不得默认偏向 `engineer`。

### D. 摘要生成

6. `POST /api/logs/{log_id}/summarize` 必须容忍历史日志的字段缺口：`climate_events` 元素的
   `confidence` 为 `null` 或缺失时必须按 `0` 处理并正常返回 `200` 与非空摘要，不得返回 `500`。
7. 接口内部错误必须返回 `500`，但响应体不得回显原始异常文本或堆栈：
   `POST /api/logs/{log_id}/summarize` 在摘要服务抛出异常时只能返回通用错误信息。
8. 摘要结果必须持久化：摘要生成后，`GET /api/logs/{log_id}` 必须能读回本次生成的非空
   `key_findings` 与 `recommendations`（均为字符串数组）。

### E. 铱星链路传输

9. 传输失败也必须留痕：当 SMTP 不可达或投递失败时，`POST /api/logs/{log_id}/transmit`
   返回 `200` 且 `transmitted=false`，该日志不得被置为已传输；同时这次失败尝试必须出现在
   `GET /api/transmission/history` 中，记录含 `log_id`、`success=false` 与非空 `error_message`。

### F. 不得回归

10. 现有 `backend/tests/test_smoke.py` 必须继续全绿；不得通过删除或放宽断言来让测试通过。

## 已知问题（现象举例，不完整）

- 上传任意后缀的文件（例如 `.txt`）后端都当作成功接收。
- 深度序列接口能写入负的深度与负的浓度。
- 「距今12000年前」这种说法在年代推断结果里会重复计两次。
- 转写文本里写小写 `co2`、`ch4` 时，温室气体事件检测不到。
- 某位发言人的工程师 / 气候学家评分相同时，角色被默认判成了「工程师」。
- 某些历史日志点「生成摘要」直接报 500，页面只显示「摘要生成失败」。
- 服务端出错时，接口返回的 `detail` 里把内部异常原文也一并带出。
- 摘要生成后重新打开日志，只有摘要正文，看不到关键发现与后续建议。
- 卫星链路发送失败的记录在「传输历史」里查不到。

## 技术栈

- 后端：FastAPI、Pydantic v2、SQLite（标准库 `sqlite3`）
- 前端：React 18、Vite 5、Ant Design 5、ECharts
- 可选：librosa / soundfile / Whisper / pyannote / OpenAI SDK / APScheduler
- 测试：pytest（`backend/tests`）

## 许可证

MIT License
