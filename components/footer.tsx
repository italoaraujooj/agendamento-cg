import Link from 'next/link'
import { Calendar, Mail, Shield, FileText } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Agendamento ICVCG</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md">
              Sistema de agendamento de ambientes da Igreja Cidade Viva CG. 
              Gerencie suas reservas de forma simples e eficiente.
            </p>
          </div>

          {/* Links Úteis */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Links Úteis</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link href="/booking" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                  Fazer Reserva
                </Link>
              </li>
              <li>
                <Link href="/reservations" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                  Minhas Reservas
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                  Meu Perfil
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:matheus.ramalho1354@gmail.com" 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors flex items-center"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Contato
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 dark:text-gray-400">
            <p>© 2025 Agendamento ICVCG. Todos os direitos reservados.</p>
            <p className="mt-2 md:mt-0">
              Desenvolvido com ❤️ para a Igreja Cidade Viva CG
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
