import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:text-white group-[.toaster]:border-0 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-2xl group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:min-w-[380px] group-[.toaster]:relative group-[.toaster]:overflow-hidden",
          description: "group-[.toast]:text-white/90 group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:mt-1",
          title: "group-[.toast]:text-white group-[.toast]:font-bold group-[.toast]:text-base group-[.toast]:flex group-[.toast]:items-center group-[.toast]:gap-3",
          actionButton:
            "group-[.toast]:bg-white/20 group-[.toast]:text-white group-[.toast]:hover:bg-white/30 group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:font-semibold group-[.toast]:transition-all group-[.toast]:border-0",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-white/80 group-[.toast]:hover:bg-white/20 group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:font-medium group-[.toast]:transition-all group-[.toast]:border-0",
          success: 
            "group-[.toast]:bg-gradient-to-br group-[.toaster]:from-emerald-500 group-[.toaster]:via-emerald-600 group-[.toaster]:to-emerald-700 group-[.toast]:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.5)] group-[.toast]:before:content-[''] group-[.toast]:before:absolute group-[.toast]:before:inset-0 group-[.toast]:before:bg-gradient-to-r group-[.toast]:before:from-white/10 group-[.toast]:before:to-transparent group-[.toast]:before:pointer-events-none",
          error: 
            "group-[.toast]:bg-gradient-to-br group-[.toaster]:from-red-500 group-[.toaster]:via-red-600 group-[.toaster]:to-red-700 group-[.toast]:shadow-[0_20px_50px_-12px_rgba(239,68,68,0.5)] group-[.toast]:before:content-[''] group-[.toast]:before:absolute group-[.toast]:before:inset-0 group-[.toast]:before:bg-gradient-to-r group-[.toast]:before:from-white/10 group-[.toast]:before:to-transparent group-[.toast]:before:pointer-events-none",
          warning: 
            "group-[.toast]:bg-gradient-to-br group-[.toaster]:from-[#FF7A3D] group-[.toaster]:via-[#FF8A4D] group-[.toaster]:to-[#FF9A5D] group-[.toast]:shadow-[0_20px_50px_-12px_rgba(255,122,61,0.5)] group-[.toast]:before:content-[''] group-[.toast]:before:absolute group-[.toast]:before:inset-0 group-[.toast]:before:bg-gradient-to-r group-[.toast]:before:from-white/10 group-[.toast]:before:to-transparent group-[.toast]:before:pointer-events-none",
          info: 
            "group-[.toast]:bg-gradient-to-br group-[.toaster]:from-blue-500 group-[.toaster]:via-blue-600 group-[.toaster]:to-blue-700 group-[.toast]:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.5)] group-[.toast]:before:content-[''] group-[.toast]:before:absolute group-[.toast]:before:inset-0 group-[.toast]:before:bg-gradient-to-r group-[.toast]:before:from-white/10 group-[.toast]:before:to-transparent group-[.toast]:before:pointer-events-none",
          loading: 
            "group-[.toast]:bg-gradient-to-br group-[.toaster]:from-[#FF7A3D] group-[.toaster]:via-[#FF8A4D] group-[.toaster]:to-[#FF9A5D] group-[.toast]:shadow-[0_20px_50px_-12px_rgba(255,122,61,0.5)] group-[.toast]:before:content-[''] group-[.toast]:before:absolute group-[.toast]:before:inset-0 group-[.toast]:before:bg-gradient-to-r group-[.toast]:before:from-white/10 group-[.toast]:before:to-transparent group-[.toast]:before:pointer-events-none",
          icon: "group-[.toast]:text-white group-[.toast]:w-6 group-[.toast]:h-6",
          closeButton: "group-[.toast]:text-white/80 group-[.toast]:hover:text-white group-[.toast]:hover:bg-white/20 group-[.toast]:rounded-lg group-[.toast]:transition-all",
        },
        duration: 4000,
      }}
      {...props}
    />
  )
}

export { Toaster }
