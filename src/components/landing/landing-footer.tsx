import Link from "next/link";
import { Mail, MapPin, Sparkles } from "lucide-react";

export const LandingFooter = () => {
  return (
    <footer className="border-t border-border/40 bg-muted/40 text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                <Sparkles className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
                  Innover
                </span>
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  Suite CRM
                </span>
              </div>
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Plataforma CRM omnicanal para empresas y comercios. Centraliza WhatsApp, Instagram y
              Facebook Messenger con inteligencia artificial y control humano.
            </p>
          </div>

          {/* Product & Channels */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Integraciones
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="#canales" className="transition hover:text-foreground">
                  WhatsApp Business Cloud API
                </Link>
              </li>
              <li>
                <Link href="#canales" className="transition hover:text-foreground">
                  Instagram Direct Messaging
                </Link>
              </li>
              <li>
                <Link href="#canales" className="transition hover:text-foreground">
                  Facebook Messenger
                </Link>
              </li>
              <li>
                <Link href="#funciones" className="transition hover:text-foreground">
                  Embudos de Ventas Kanban
                </Link>
              </li>
              <li>
                <Link href="#funciones" className="transition hover:text-foreground">
                  Agente IA con Traspaso Humano
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Legal y Privacidad
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/privacy" className="transition hover:text-foreground">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition hover:text-foreground">
                  Condiciones del Servicio
                </Link>
              </li>
              <li>
                <Link href="/privacy#eliminacion" className="transition hover:text-foreground">
                  Instrucciones de Eliminación de Datos
                </Link>
              </li>
              <li>
                <Link href="#seguridad" className="transition hover:text-foreground">
                  Cumplimiento de Políticas de Meta
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Contacto y Soporte
            </p>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 text-primary" />
                <a
                  href="mailto:privacidad@innover-suite.app"
                  className="transition hover:text-foreground"
                >
                  privacidad@innover-suite.app
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-3.5 text-primary" />
                <span>Caracas, Venezuela</span>
              </li>
              <li className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
                Atención para solicitudes de verificación de plataforma, soporte técnico y derechos
                ARCO.
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer for Meta & Copyright */}
        <div className="mt-12 border-t border-border/40 pt-8">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Aviso de marcas: WhatsApp, Instagram y Facebook Messenger son marcas comerciales
            registradas propiedad de Meta Platforms, Inc. Innover Suite es una solución de software
            independiente que se conecta a los servicios de Meta a través de sus APIs públicas y
            empresariales oficiales.
          </p>
          <div className="mt-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              © 2026 Innover Suite. Todos los derechos reservados.
            </p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="hover:underline">
                Privacidad
              </Link>
              <Link href="/terms" className="hover:underline">
                Condiciones
              </Link>
              <Link href="/login" className="hover:underline">
                Acceso Asesores
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
