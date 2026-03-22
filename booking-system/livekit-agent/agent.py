"""
First Medical Center — LiveKit Voice Agent with LiveAvatar
=========================================================
A voice AI agent with a virtual avatar for the First Medical Center clinic.
The avatar greets visitors, answers questions about services, branches, and
helps guide them to booking.

Usage:
    uv run agent.py dev        # Development mode (connects to LiveKit Cloud)
    uv run agent.py console    # Console mode (local testing, no avatar)

Requirements:
    uv add "livekit-agents[liveavatar,silero,turn-detector,openai]~=1.4" \
           "livekit-plugins-noise-cancellation~=0.2" \
           "python-dotenv"

Environment variables (from ../.env.local):
    LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
    LIVEAVATAR_API_KEY, LIVEAVATAR_AVATAR_ID
    OPENAI_API_KEY
"""

import os
import json
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from livekit.plugins import liveavatar

# Load env vars from both local file and parent directory
load_dotenv(".env.local")
load_dotenv("../.env.local")

# ─── Agent Instructions ───────────────────────────────────────────────
AGENT_INSTRUCTIONS = """
You are a friendly AI receptionist for First Medical Center LLC, a premium aesthetic
and laser clinic in Dubai, UAE. You speak warmly and professionally.

Key facts about the clinic:
- 3 branches: Al Muraqabat (Deira), Al Qiyadah (Abu Hail), Silicon Oasis
- Services: Laser Hair Removal, Dermal Fillers & Botox, PRP, Chemical Peeling,
  RF Microneedling, Hydrafacial, and more
- DHA Licensed healthcare facility
- Operating hours: Mon–Sat, 10 AM – 10 PM
- Contact: Al Muraqabat +971 4 250 6262, Al Qiyadah +971 4 261 7171,
  Silicon Oasis +971 4 392 0809

Your behavior:
- Greet visitors warmly and ask how you can help
- Answer questions about services, pricing ranges, and branches
- Guide users to book appointments through the website
- Speak concisely — limit responses to 2-3 sentences maximum
- If asked about specific pricing, say "prices start from" and suggest booking a
  consultation for exact pricing
- Do NOT discuss competitor clinics
- Speak English by default, but switch to Arabic if the user speaks Arabic
- Be enthusiastic about the clinic's premium services and expert doctors
- Your session is limited to 3 minutes, so be efficient and helpful

Do NOT use any formatting, emojis, asterisks, or special characters in your responses.
Keep it natural and conversational.
"""


class ClinicAssistant(Agent):
    """AI receptionist agent for First Medical Center."""

    def __init__(self, user_name: str = "", gender: str = "") -> None:
        instructions = AGENT_INSTRUCTIONS
        if user_name:
            prefix = "Mr. " if gender.lower() == "male" else ("Ms. " if gender.lower() == "female" else "")
            instructions += f"\n\nIMPORTANT CONTEXT:\n- The user's name is {prefix}{user_name.strip()}."
            if gender:
                instructions += f"\n- The user's gender is {gender}. If communicating in Arabic, ensure you use the correct feminine/masculine grammatical expressions for a {gender}."
            instructions += "\n- Do NOT ask for the user's name, gender, or personal details, as you already know them. Address them by their name naturally."

        super().__init__(instructions=instructions)


# ─── Server Setup ─────────────────────────────────────────────────────
server = AgentServer()


@server.rtc_session(agent_name="Alfrin")
async def fmc_agent(ctx: agents.JobContext):
    """Handle a new visitor session with avatar."""

    # Create the agent session with STT → LLM → TTS pipeline
    session = AgentSession(
        stt="deepgram/nova-3:multi",         # Speech-to-Text
        llm="openai/gpt-4.1-mini",           # LLM for conversation
        tts="openai/tts-1",                  # Text-to-Speech (OpenAI voices)
        vad=silero.VAD.load(),               # Voice Activity Detection
        turn_detection=MultilingualModel(),   # Turn detection
    )

    # Wait for the user participant to connect FIRST (before the avatar joins and pollutes the participant list)
    participant = await ctx.wait_for_participant()
    user_name = ""
    gender = ""

    # Create the LiveAvatar session
    avatar_id = os.getenv("LIVEAVATAR_AVATAR_ID", "")
    avatar = liveavatar.AvatarSession(
        avatar_id=avatar_id,
    )

    # Start the avatar worker (it joins the room as a participant)
    await avatar.start(session, room=ctx.room)
    
    if participant.metadata:
        try:
            meta = json.loads(participant.metadata)
            user_name = meta.get("userName", "")
            gender = meta.get("gender", "")
        except json.JSONDecodeError:
            pass

    # Start the agent session
    await session.start(
        room=ctx.room,
        agent=ClinicAssistant(user_name=user_name, gender=gender),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # Generate an initial greeting
    greeting_instructions = "Greet the visitor warmly. "
    if user_name:
        prefix = "Mr. " if gender.lower() == "male" else ("Ms. " if gender.lower() == "female" else "")
        greeting_instructions += (
            f"Address them personally as '{prefix}{user_name}'. Say something like: "
            f"'Hello {prefix}{user_name}! Welcome to First Medical Center. I am your virtual assistant. How can I help you today?' "
            "Do NOT ask for their name."
        )
    else:
        greeting_instructions += (
            "Say something like: 'Hello! Welcome to First Medical Center. I am your virtual assistant. "
            "How can I help you today?'"
        )
    greeting_instructions += " Keep it brief and friendly."

    await session.generate_reply(instructions=greeting_instructions)


if __name__ == "__main__":
    agents.cli.run_app(server)
