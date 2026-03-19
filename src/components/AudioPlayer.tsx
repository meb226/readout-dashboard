interface AudioPlayerProps {
  src: string;
  label: string;
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  return (
    <div className="bg-[#f5f5f5] rounded-lg p-3">
      <p className="text-xs font-semibold text-text-muted font-heading mb-2">{label}</p>
      <audio controls preload="none" className="w-full h-8" style={{ colorScheme: "light" }}>
        <source src={src} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
