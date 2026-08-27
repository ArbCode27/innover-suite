import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACT_EMAIL = "privacidad@innover-suite.app";
const LAST_UPDATED = "26 de agosto de 2026";

export const metadata: Metadata = {
  title: "Condiciones del servicio | Innover Suite",
  description:
    "Términos de uso de Innover Suite para el CRM, Messenger, Instagram, WhatsApp y la atención asistida por IA.",
};

const sections = [
  {
    title: "1. Aceptación",
    body: [
      "Estas condiciones regulan el uso de Innover Suite, un CRM omnicanal para atender conversaciones, contactos, citas, pedidos y embudos de venta. Al crear una cuenta, iniciar sesión o conectar un canal de Meta, aceptas este documento y la Política de privacidad.",
      "Si usas el servicio en nombre de un negocio, declaras que tienes autoridad para vincular a esa organización.",
    ],
  },
  {
    title: "2. El servicio",
    body: [
      "Innover Suite permite a un negocio:",
    ],
    items: [
      "Recibir y responder chats de Messenger, Instagram y WhatsApp en un inbox unificado.",
      "Usar un agente de IA para atender conversaciones, con cesión a asesores humanos.",
      "Gestionar contactos, calendario, embudos, catálogo, pedidos y ajustes de la organización.",
      "Conectar Google Calendar, si el negocio activa esa integración.",
    ],
  },
  {
    title: "3. Cuentas y organizaciones",
    body: [
      "El acceso requiere autenticación. Cada organización es responsable de sus usuarios, roles e invitaciones. Debes mantener credenciales seguras y avisar de un uso no autorizado.",
      "El owner o admin configura canales, horarios, módulos y el agente de IA. Las acciones de los miembros se atribuyen a esa organización.",
    ],
  },
  {
    title: "4. Canales de Meta",
    body: [
      "Al conectar Messenger, Instagram o WhatsApp, el negocio autoriza a Innover Suite a enviar y recibir mensajes en su nombre mediante las APIs de Meta.",
    ],
    items: [
      "Debes cumplir las políticas de Meta, WhatsApp Business y las normas de mensajería aplicables.",
      "No uses el servicio para spam, mensajes no solicitados fuera de las ventanas permitidas, ni contenidos ilícitos.",
      "Eres responsable del número, la Página o la cuenta que conectes, y de obtener el consentimiento de tus clientes cuando la ley lo exija.",
      "Meta puede suspender un canal; Innover Suite no controla esas decisiones.",
    ],
  },
  {
    title: "5. Inteligencia artificial",
    body: [
      "La IA genera respuestas a partir de los mensajes recibidos, la configuración del agente y el conocimiento que el negocio cargue. No garantiza exactitud, disponibilidad continua ni resultados comerciales.",
      "El negocio debe revisar políticas, horarios y modo humano/IA. No uses la IA para asesoría médica, legal o financiera regulada sin supervisión adecuada.",
    ],
  },
  {
    title: "6. Uso aceptable",
    items: [
      "No intentes acceder a datos de otras organizaciones ni eludir autenticación, firmas de webhook o límites del sistema.",
      "No sobrecargues la plataforma ni uses el servicio para malware, fraude o suplantación.",
      "No publiques ni almacenes contenido ilegal, ni datos de menores de 13 años de forma intencional.",
      "No revendemos el acceso a APIs de Meta como producto independiente fuera de este CRM.",
    ],
  },
  {
    title: "7. Propiedad intelectual",
    body: [
      "Innover Suite, su marca, diseño y código son de sus titulares. El negocio conserva la titularidad de sus contactos, mensajes, catálogo y contenidos que cargue, y nos concede una licencia limitada para operar el servicio.",
    ],
  },
  {
    title: "8. Disponibilidad y cambios",
    body: [
      "Prestamos el servicio “tal cual”. Puede haber mantenimiento, errores o interrupciones de Meta, Google, Supabase o el hosting. Podemos modificar funciones con aviso razonable cuando el cambio sea material.",
    ],
  },
  {
    title: "9. Responsabilidad",
    body: [
      "En la medida permitida por la ley, Innover Suite no responde de lucro cesante, pérdida de datos de terceros, sanciones de Meta o daños indirectos derivados del uso del CRM o de las respuestas de la IA.",
      "Nuestra responsabilidad total frente a una organización, por cualquier reclamación relacionada con el servicio, se limita a lo efectivamente pagado por esa organización en los tres meses anteriores al hecho, o a cero si el servicio se presta sin cobro de suscripción.",
    ],
  },
  {
    title: "10. Terminación",
    body: [
      "Puedes dejar de usar el servicio y pedir la desconexión de canales o la eliminación de datos según la Política de privacidad. Podemos suspender o cerrar el acceso si hay incumplimiento, riesgo de seguridad o requerimiento legal.",
    ],
  },
  {
    title: "11. Ley aplicable",
    body: [
      "Estas condiciones se rigen por las leyes de la República Bolivariana de Venezuela. Cualquier disputa se someterá a los tribunales competentes de Caracas, salvo norma imperativa en contrario.",
    ],
  },
  {
    title: "12. Contacto y cambios",
    body: [
      `Consultas sobre estas condiciones: ${CONTACT_EMAIL}. Si las actualizamos, publicaremos la nueva fecha en esta página. El uso continuado después de un cambio sustancial implica aceptación de la versión vigente.`,
    ],
  },
] as const;

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Innover Suite
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Condiciones del servicio</h1>
          <p className="text-sm text-muted-foreground">Última actualización: {LAST_UPDATED}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>
              Estas condiciones describen el uso permitido de Innover Suite, incluidas las
              integraciones con Messenger, Instagram, WhatsApp y la atención asistida por IA.
            </p>
            <p>
              La privacidad se explica aparte en la{" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/privacy">
                Política de privacidad
              </Link>
              . Contacto:{" "}
              <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </CardContent>
        </Card>

        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
            {"body" in section
              ? section.body?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))
              : null}
            {"items" in section && section.items ? (
              <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild variant="outline">
            <Link href="/privacy">Política de privacidad</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Volver al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
