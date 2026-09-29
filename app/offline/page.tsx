import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Sem conexão - Cidade Viva CG",
}

export default function OfflinePage() {
  return (
    <div className="container mx-auto max-w-md px-4 py-16 text-center space-y-4">
      <Image
        src="/icons/icon-192.png"
        alt="Cidade Viva CG"
        width={80}
        height={80}
        className="mx-auto rounded-2xl"
        unoptimized
      />
      <h1 className="text-2xl font-bold">Você está sem conexão</h1>
      <p className="text-muted-foreground">
        Verifique sua internet e tente novamente. Agendamentos e escalas só
        podem ser consultados online, para garantir que você veja sempre as
        informações mais recentes.
      </p>
    </div>
  )
}
