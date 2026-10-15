import logo from '../assets/logo.png'

export function WelcomeScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 select-none">
      <img src={logo} alt="Spectrum logo" className="w-16 h-auto" />
      <div className="text-center">
        <p className="text-xl font-semibold text-[#e6edf3]">Spectrum</p>
        <p className="text-xs text-[#8b949e] mt-1">AI code editor with free models</p>
      </div>
      <div className="flex flex-col gap-2 w-64 text-xs text-[#8b949e]">
        <div className="flex justify-between rounded-md px-3 py-2 bg-[#161b22] border border-[#30363d]">
          <span>Open a folder</span>
          <span>Explorer → Open Folder</span>
        </div>
        <div className="flex justify-between rounded-md px-3 py-2 bg-[#161b22] border border-[#30363d]">
          <span>Ask the agent</span>
          <span>Chat box →</span>
        </div>
      </div>
    </div>
  )
}
