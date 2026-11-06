import {AccountAccessOptions} from "@/components/account-access-options";
import { LoginForm } from "@/components/account-forms";
export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cu-sidebar px-5 py-12">
      <section aria-labelledby="login-title" className="w-full max-w-md rounded-xl border border-cu-border bg-cu-panel p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-cu-purple">SAV3 · Open ClickUp</p>
        <h1 id="login-title" className="mt-5 text-2xl font-semibold text-cu-text">El espacio de trabajo del equipo</h1>
        <p className="mt-3 text-sm leading-6 text-cu-text-secondary">Ingresá con una cuenta autorizada para consultar tus tareas y colaborar con el equipo.</p>
        <LoginForm /><AccountAccessOptions/>
        <a href="/signin-with-chatgpt?return_to=%2Fhome" target="_top" className="mt-7 flex min-h-11 items-center justify-center rounded-md bg-cu-purple px-4 py-3 text-sm font-semibold text-white hover:bg-cu-purple-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cu-purple">Acceso del propietario con ChatGPT</a>
        <a href="/home" className="mt-4 block rounded text-center text-sm text-cu-purple underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cu-purple">Ya inicié sesión: abrir mi espacio</a>
        <p className="mt-7 border-t border-cu-border pt-5 text-xs leading-5 text-cu-text-secondary">La página de entrada es pública. Las tareas, los documentos y los adjuntos requieren acceso autorizado.</p>
      </section>
    </main>
  );
}
