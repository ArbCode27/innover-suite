import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACT_EMAIL = "privacidad@innover-suite.app";
const LAST_UPDATED = "19 de agosto de 2026";

export const metadata: Metadata = {
  title: "Política de privacidad | Innover Suite",
  description:
    "Cómo Innover Suite recopila, usa y protege los datos de Messenger, Instagram y WhatsApp.",
};

const sections = [
  {
    title: "1. Responsable",
    body: [
      `Innover Suite es un CRM omnicanal operado para la atención de conversaciones, contactos, citas y embudos de venta. Para ejercer derechos o hacer consultas de privacidad, escribe a ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: "2. Qué datos recopilamos",
    body: [
      "Cuando un negocio conecta Messenger, Instagram o WhatsApp, podemos recibir y almacenar:",
    ],
    items: [
      "Identificadores de Meta: PSID, IGSID, WhatsApp ID y phone number ID.",
      "Nombre de perfil y número de teléfono, si la plataforma los envía.",
      "Contenido de mensajes, adjuntos, marcas de tiempo y estado de la conversación.",
      "Datos de la cuenta del negocio: Page ID, Instagram account ID y número de WhatsApp Business.",
      "Datos de usuarios del CRM: correo electrónico y sesión de autenticación.",
      "Citas y datos de Google Calendar, si esa integración está activa.",
    ],
  },
  {
    title: "3. Para qué los usamos",
    items: [
      "Mostrar y responder conversaciones en el inbox del CRM.",
      "Crear o actualizar contactos, embudos y citas.",
      "Generar respuestas asistidas por IA a partir del mensaje recibido.",
      "Verificar webhooks, evitar duplicados y mantener la seguridad del servicio.",
    ],
    body: [
      "No vendemos datos de usuarios de Meta. No usamos esos datos para anuncios de terceros ni para entrenar modelos de IA ajenos al servicio de atención del negocio.",
    ],
  },
  {
    title: "4. Con quién los compartimos",
    items: [
      "Meta Platforms, para enviar y recibir mensajes de Messenger, Instagram y WhatsApp.",
      "Supabase, como base de datos y autenticación.",
      "Google Gemini, solo para generar respuestas del chat cuando la IA está activa.",
      "Google Calendar, solo si el negocio conecta esa función.",
      "Vercel, como hosting de la aplicación.",
    ],
  },
  {
    title: "5. Conservación",
    body: [
      "Conservamos mensajes, contactos y eventos de webhook mientras la cuenta del negocio esté activa y sea necesario para prestar el servicio, cumplir obligaciones legales o resolver incidencias. El negocio puede solicitar la eliminación de esos datos.",
    ],
  },
  {
    title: "6. Derechos y eliminación",
    body: [
      `El usuario o el negocio puede pedir acceso, corrección o borrado de sus datos en ${CONTACT_EMAIL}. Atenderemos la solicitud en un plazo razonable y eliminaremos los datos asociados en Innover Suite, salvo que debamos conservarlos por obligación legal.`,
    ],
  },
  {
    title: "7. Seguridad",
    body: [
      "Los webhooks de Meta se validan con firma. El acceso al CRM requiere autenticación. Las claves de servicio no se exponen en el navegador.",
    ],
  },
  {
    title: "8. Menores",
    body: [
      "El servicio no está dirigido a menores de 13 años y no recopila datos de menores de forma intencional.",
    ],
  },
  {
    title: "9. Cambios",
    body: [
      "Si actualizamos esta política, publicaremos la nueva fecha en esta página.",
    ],
  },
] as const;

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Innover Suite
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Política de privacidad</h1>
          <p className="text-sm text-muted-foreground">Última actualización: {LAST_UPDATED}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>
              Esta política describe cómo Innover Suite trata los datos que recibe de
              Messenger, Instagram, WhatsApp y del propio CRM, para que Meta y los
              usuarios puedan revisar el uso de esa información.
            </p>
            <p>
              Contacto de privacidad:{" "}
              <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              . Las reglas de uso están en las{" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/terms">
                Condiciones del servicio
              </Link>
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
            <Link href="/terms">Condiciones del servicio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Volver al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
