/**
 * components/Logo.tsx
 * Composant logo réutilisable — Institut Al-Itqan
 *
 * Usage :
 *   <Logo />                    → taille md, avec texte
 *   <Logo size="sm" />          → petit (navbar)
 *   <Logo size="lg" />          → grand (couverture)
 *   <Logo size="xl" />          → très grand (page login)
 *   <Logo showText={false} />   → icône seule
 *   <Logo light />              → texte blanc (sur fond sombre)
 */

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type LogoProps = {
  size?:     LogoSize
  showText?: boolean
  light?:    boolean          // true → texte blanc (sur fond bordeaux)
  className?: string
}

const SIZE_MAP: Record<LogoSize, { img: string; title: string; sub: string }> = {
  xs: { img: 'h-6 w-auto',   title: 'text-xs',                sub: 'hidden'   },
  sm: { img: 'h-8 w-auto',   title: 'text-sm font-bold',      sub: 'text-xs'  },
  md: { img: 'h-10 w-auto',  title: 'text-base font-bold',    sub: 'text-xs'  },
  lg: { img: 'h-16 w-auto',  title: 'text-xl font-bold',      sub: 'text-sm'  },
  xl: { img: 'h-24 w-auto',  title: 'text-2xl font-bold',     sub: 'text-sm'  },
}

export default function Logo({
  size      = 'md',
  showText  = true,
  light     = false,
  className = '',
}: LogoProps) {
  const s = SIZE_MAP[size]

  const titleColor = light ? 'text-white'       : 'text-[#5C1527]'
  const subColor   = light ? 'text-white/60'    : 'text-[#9A7535]'

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Image logo */}
      <img
        src="/logo.png"
        alt="Logo Institut Al-Itqan"
        className={`${s.img} object-contain flex-shrink-0`}
        draggable={false}
      />

      {/* Texte */}
      {showText && (
        <div className="leading-tight">
          <p className={`${s.title} ${titleColor} tracking-tight`}>
            Institut Al-Itqan
          </p>
          {s.sub !== 'hidden' && (
            <p className={`${s.sub} ${subColor} font-medium`}>
              الإتقان
            </p>
          )}
        </div>
      )}
    </div>
  )
}
