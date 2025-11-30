export default function PlaySound(sound) {
    const audio = new Audio(sound);
    audio.play().catch(err => console.error('Audio play failed', err));
};