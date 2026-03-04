# First Medical Center — LiveKit Voice Agent with LiveAvatar

A Python-based AI voice agent with a virtual avatar for First Medical Center.

## Quick Setup

### 1. Install `uv` (Python package manager)

```bash
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or with pip
pip install uv
```

### 2. Initialize the project

```bash
cd livekit-agent
uv init --bare
```

### 3. Install dependencies

```bash
uv add "livekit-agents[liveavatar,silero,turn-detector,openai]~=1.4" \
       "livekit-plugins-noise-cancellation~=0.2" \
       "python-dotenv"
```

### 4. Create `.env.local`

Copy credentials from the parent project's `.env.local`:

```bash
LIVEKIT_API_KEY=APImJXBSWcUXYMG
LIVEKIT_API_SECRET=xmBCgt2nyfIgr5NanaSbLCMid1X8egrG107o2fYZ5QNA
LIVEKIT_URL=wss://dubaifmc-b2qvzg4h.livekit.cloud
LIVEAVATAR_API_KEY=b8c4fd62-bb05-4458-ae31-6deef6167f2a
LIVEAVATAR_AVATAR_ID=fc943d98-9a13-4867-8b6e-d48d5e75f8e3
OPENAI_API_KEY=<your OpenAI API key>
DEEPGRAM_API_KEY=<your Deepgram API key>
```

### 5. Download model files

```bash
uv run agent.py download-files
```

### 6. Run in development mode

```bash
uv run agent.py dev
```

The agent will connect to your LiveKit Cloud project and wait for visitors.

### 7. Test with Agents Playground

Visit [LiveKit Agents Playground](https://cloud.livekit.io) and connect to your project to test the avatar.

## Architecture

```
User (mobile browser)
    ↕ WebRTC
LiveKit Cloud (room)
    ↕
Agent (this Python script)
    ├── STT: Deepgram Nova 3
    ├── LLM: OpenAI GPT-4.1-mini
    ├── TTS: OpenAI TTS-1
    └── Avatar: LiveAvatar (HeyGen)
         → publishes video + audio tracks to room
```
