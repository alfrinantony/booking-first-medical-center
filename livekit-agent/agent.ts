import {
    type JobContext,
    type JobProcess,
    WorkerOptions,
    cli,
    defineAgent,
    llm,
    voice,
    inference,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Load environment variables from .env.local (LiveKit convention)
config({ path: '.env.local' });

/**
 * LiveKit AI Agent for Booking First Medical Center
 *
 * This agent:
 * 1. Joins a LiveKit room when a user connects
 * 2. Listens to user speech via WebRTC (STT)
 * 3. Processes with an LLM for intelligent responses
 * 4. Speaks back via TTS
 * 5. Optionally drives a LiveAvatar virtual avatar
 *
 * Run in dev mode:   npx tsx agent.ts dev
 * Run in prod mode:  npx tsx agent.ts start
 */

export default defineAgent({
    prewarm: async (proc: JobProcess) => {
        // Pre-load the VAD model for faster startup
        proc.userData.vad = await silero.VAD.load();
    },

    entry: async (ctx: JobContext) => {
        // Define the AI agent with medical assistant instructions
        const agent = new voice.Agent({
            instructions: `You are a friendly and professional AI medical assistant for Booking First Medical Center.

Your role is to:
- Greet patients warmly and help them with appointment bookings
- Answer general questions about the clinic's services, departments, and doctors
- Guide patients through the booking process
- Provide general health information (but always recommend consulting a doctor for medical advice)
- Be empathetic, patient, and clear in your communication

Important guidelines:
- Keep responses concise and conversational (this is a voice interface)
- Do not provide specific medical diagnoses or prescriptions
- Always recommend visiting a doctor for medical concerns
- Be professional yet warm and approachable
- Speak in clear, simple language
- If you don't know something, say so honestly`,
        });

        // Create the voice agent session with STT → LLM → TTS pipeline
        const session = new voice.AgentSession({
            // Speech-to-text: converts user's voice to text
            stt: new inference.STT({
                model: 'deepgram/nova-3',
                language: 'en',
            }),

            // Large Language Model: the agent's brain
            llm: new inference.LLM({
                model: 'openai/gpt-4.1-mini',
            }),

            // Text-to-speech: converts LLM response to voice
            tts: new inference.TTS({
                model: 'cartesia/sonic-3',
                voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
            }),

            // Voice Activity Detection: detects when user is speaking
            vad: ctx.proc.userData.vad! as silero.VAD,
        });

        // Start the agent session, connecting to the LiveKit room
        await session.start({
            agent,
            room: ctx.room,
        });

        // Generate an initial greeting
        await session.generateReply({
            instructions:
                'Greet the patient warmly. Introduce yourself as the AI assistant for Booking First Medical Center. Ask how you can help them today — whether they want to book an appointment, learn about services, or have any questions.',
        });
    },
});

// Start the agent worker
cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
