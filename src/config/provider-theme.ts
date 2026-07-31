import type React from 'react';

/**
 * Tema por provider — fonte ÚNICA de identidade visual das telas de provider.
 *
 * Regra (frente de padronização, 31/07): base neutra compartilhada + 1 cor de
 * destaque POR provider, pra o operador saber de relance em qual conta está
 * agindo (5 telas parecidas abertas = risco de compensar/agir na tela errada).
 *
 * Consumo: a tela envolve o conteúdo num wrapper com style={providerCssVars(theme)}
 * e os componentes/classes usam as CSS vars via arbitrary values ESTÁTICOS do
 * Tailwind (ex.: `text-[color:var(--provider-accent)]`) — classe estática compila,
 * a var resolve por escopo em runtime. NÃO montar classe Tailwind por string
 * dinâmica (não compila).
 */
export interface ProviderTheme {
  key: string;
  label: string;
  badge: string;
  /** Cor de destaque — a única coisa que muda entre providers. */
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentHover: string;
}

function theme(key: string, label: string, badge: string, r: number, g: number, b: number): ProviderTheme {
  return {
    key,
    label,
    badge,
    accent: `rgb(${r},${g},${b})`,
    accentSoft: `rgba(${r},${g},${b},0.1)`,
    accentBorder: `rgba(${r},${g},${b},0.4)`,
    accentHover: `rgba(${r},${g},${b},0.2)`,
  };
}

export const PROVIDER_THEMES: Record<string, ProviderTheme> = {
  brasilcash: theme('brasilcash', 'BrasilCash', 'Banking', 255, 140, 0), // laranja (cor atual da tela)
  ntx: theme('ntx', 'NTX Pay', 'Banking', 139, 92, 246), // violeta
  fyhub: theme('fyhub', 'FyHub', 'Banking', 20, 184, 166), // teal (reservado — tela futura)
  belmontx: theme('belmontx', 'BelmontX', 'Banking', 234, 179, 8), // âmbar (reservado)
  corpx_v2: theme('corpx_v2', 'CorpX', 'Banking', 0, 105, 209), // azul (reservado)
};

/** CSS vars consumidas pelos componentes compartilhados e pelas classes var-based. */
export function providerCssVars(t: ProviderTheme): React.CSSProperties {
  return {
    '--provider-accent': t.accent,
    '--provider-soft': t.accentSoft,
    '--provider-border': t.accentBorder,
    '--provider-hover': t.accentHover,
  } as React.CSSProperties;
}
