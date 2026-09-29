import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Igreja Cidade Viva Campina Grande</p>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privacidade
          </Link>
          <a href="mailto:matheus.ramalho1354@gmail.com" className="hover:text-primary transition-colors">
            Contato
          </a>
        </nav>
      </div>
    </footer>
  )
}
