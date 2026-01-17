import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Mail, Calendar, FileText, Lock, Users, Globe, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Política de Privacidade
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Transparência sobre como coletamos, usamos e protegemos seus dados pessoais
          </p>
          <Badge variant="outline" className="mt-4">
            Última atualização: 10 de setembro de 2025
          </Badge>
        </div>

        {/* Navigation Menu */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Índice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="#interpretacao" className="text-blue-600 hover:underline">• Interpretação e Definições</Link>
              <Link href="#coleta" className="text-blue-600 hover:underline">• Coleta de Dados</Link>
              <Link href="#uso" className="text-blue-600 hover:underline">• Uso dos Dados</Link>
              <Link href="#retencao" className="text-blue-600 hover:underline">• Retenção de Dados</Link>
              <Link href="#transferencia" className="text-blue-600 hover:underline">• Transferência de Dados</Link>
              <Link href="#seguranca" className="text-blue-600 hover:underline">• Segurança</Link>
              <Link href="#criancas" className="text-blue-600 hover:underline">• Privacidade de Menores</Link>
              <Link href="#alteracoes" className="text-blue-600 hover:underline">• Alterações</Link>
              <Link href="#contato" className="text-blue-600 hover:underline">• Contato</Link>
            </div>
          </CardContent>
        </Card>

        {/* Introduction */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-lg leading-relaxed">
                Esta Política de Privacidade descreve nossas políticas e procedimentos sobre a coleta, uso e divulgação de suas informações quando você usa nosso Serviço e informa sobre seus direitos de privacidade e como a lei o protege.
              </p>
              <p>
                Usamos seus dados pessoais para fornecer e melhorar o Serviço. Ao usar o Serviço, você concorda com a coleta e uso de informações de acordo com esta Política de Privacidade.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Interpretação e Definições */}
        <Card className="mb-8" id="interpretacao">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Interpretação e Definições
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h3>Interpretação</h3>
              <p>
                As palavras cuja letra inicial está em maiúscula têm significados definidos nas seguintes condições. 
                As seguintes definições terão o mesmo significado, independentemente de aparecerem no singular ou no plural.
              </p>
              
              <h3>Definições</h3>
              <p>Para os fins desta Política de Privacidade:</p>
              <ul className="space-y-2">
                <li><strong>Conta</strong> significa uma conta única criada para você acessar nosso Serviço ou partes do nosso Serviço.</li>
                <li><strong>Afiliada</strong> significa uma entidade que controla, é controlada por ou está sob controle comum com uma parte.</li>
                <li><strong>Empresa</strong> (referida como "a Empresa", "Nós", "Nos" ou "Nosso" neste Acordo) refere-se ao Agendamento ICVCG.</li>
                <li><strong>Cookies</strong> são pequenos arquivos colocados no seu computador, dispositivo móvel ou qualquer outro dispositivo por um site.</li>
                <li><strong>País</strong> refere-se ao Brasil.</li>
                <li><strong>Dispositivo</strong> significa qualquer dispositivo que possa acessar o Serviço, como um computador, telefone celular ou tablet digital.</li>
                <li><strong>Dados Pessoais</strong> são qualquer informação relacionada a um indivíduo identificado ou identificável.</li>
                <li><strong>Serviço</strong> refere-se ao Site.</li>
                <li><strong>Provedor de Serviços</strong> significa qualquer pessoa física ou jurídica que processa os dados em nome da Empresa.</li>
                <li><strong>Dados de Uso</strong> refere-se aos dados coletados automaticamente, gerados pelo uso do Serviço.</li>
                <li><strong>Site</strong> refere-se ao Agendamento ICVCG, acessível em <a href="https://agendamento-cg.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://agendamento-cg.vercel.app/</a></li>
                <li><strong>Você</strong> significa o indivíduo que acessa ou usa o Serviço.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Coleta de Dados */}
        <Card className="mb-8" id="coleta">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Coleta e Uso de Seus Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h3>Tipos de Dados Coletados</h3>
              
              <h4 className="flex items-center mt-6">
                <Mail className="h-4 w-4 mr-2" />
                Dados Pessoais
              </h4>
              <p>
                Ao usar nosso Serviço, podemos solicitar que você nos forneça certas informações pessoalmente identificáveis 
                que podem ser usadas para contatá-lo ou identificá-lo. As informações pessoalmente identificáveis podem incluir, mas não se limitam a:
              </p>
              <ul>
                <li>Endereço de email</li>
                <li>Nome e sobrenome</li>
                <li>Número de telefone</li>
                <li>Dados de Uso</li>
              </ul>

              <h4 className="flex items-center mt-6">
                <Calendar className="h-4 w-4 mr-2" />
                Dados de Uso
              </h4>
              <p>
                Os Dados de Uso são coletados automaticamente ao usar o Serviço e podem incluir informações como 
                endereço IP do seu dispositivo, tipo de navegador, versão do navegador, as páginas do nosso Serviço que você visita, 
                a hora e data da sua visita, o tempo gasto nessas páginas, identificadores únicos do dispositivo e outros dados de diagnóstico.
              </p>

              <h4 className="flex items-center mt-6">
                <Globe className="h-4 w-4 mr-2" />
                Tecnologias de Rastreamento e Cookies
              </h4>
              <p>
                Usamos Cookies e tecnologias de rastreamento similares para rastrear a atividade em nosso Serviço e armazenar certas informações. 
                As tecnologias de rastreamento usadas são beacons, tags e scripts para coletar e rastrear informações e para melhorar e analisar nosso Serviço.
              </p>
              <ul>
                <li><strong>Cookies Necessários/Essenciais:</strong> Estes Cookies são essenciais para fornecer serviços disponíveis através do Site.</li>
                <li><strong>Cookies de Funcionalidade:</strong> Estes Cookies nos permitem lembrar das escolhas que você faz ao usar o Site.</li>
                <li><strong>Cookies de Política:</strong> Estes Cookies identificam se os usuários aceitaram o uso de cookies no Site.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Uso dos Dados */}
        <Card className="mb-8" id="uso">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Uso de Seus Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>A Empresa pode usar os Dados Pessoais para os seguintes propósitos:</p>
              <ul className="space-y-2">
                <li><strong>Para fornecer e manter nosso Serviço</strong>, incluindo monitorar o uso do nosso Serviço.</li>
                <li><strong>Para gerenciar sua Conta:</strong> para gerenciar seu registro como usuário do Serviço.</li>
                <li><strong>Para execução de contrato:</strong> desenvolvimento, conformidade e execução do contrato de compra.</li>
                <li><strong>Para contatá-lo:</strong> Para contatá-lo por email, chamadas telefônicas, SMS ou outras formas equivalentes de comunicação eletrônica.</li>
                <li><strong>Para fornecer</strong> notícias, ofertas especiais e informações gerais sobre outros bens, serviços e eventos que oferecemos.</li>
                <li><strong>Para gerenciar suas solicitações:</strong> Para atender e gerenciar suas solicitações para nós.</li>
                <li><strong>Para transferências comerciais:</strong> Podemos usar suas informações para avaliar ou conduzir uma fusão, alienação, reestruturação, reorganização, dissolução ou outra venda.</li>
                <li><strong>Para outros propósitos:</strong> Podemos usar suas informações para outros propósitos, como análise de dados, identificação de tendências de uso, determinação da eficácia de nossas campanhas promocionais.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Retenção de Dados */}
        <Card className="mb-8" id="retencao">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Retenção de Seus Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                A Empresa reterá seus Dados Pessoais apenas pelo tempo necessário para os propósitos estabelecidos nesta Política de Privacidade. 
                Reteremos e usaremos seus Dados Pessoais na medida necessária para cumprir nossas obrigações legais, resolver disputas e fazer cumprir nossos acordos legais e políticas.
              </p>
              <p>
                A Empresa também reterá Dados de Uso para fins de análise interna. Os Dados de Uso são geralmente retidos por um período mais curto, 
                exceto quando esses dados são usados para fortalecer a segurança ou melhorar a funcionalidade do nosso Serviço.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Transferência de Dados */}
        <Card className="mb-8" id="transferencia">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Transferência de Seus Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Suas informações, incluindo Dados Pessoais, são processadas nos escritórios operacionais da Empresa e em qualquer outro local onde as partes envolvidas no processamento estejam localizadas. 
                Isso significa que essas informações podem ser transferidas para — e mantidas em — computadores localizados fora do seu estado, província, país ou outra jurisdição governamental.
              </p>
              <p>
                Seu consentimento a esta Política de Privacidade seguido de seu envio de tais informações representa sua concordância com essa transferência.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Exclusão de Dados */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Exclusão de Seus Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Você tem o direito de excluir ou solicitar que auxiliemos na exclusão dos Dados Pessoais que coletamos sobre você.
              </p>
              <p>
                Nosso Serviço pode dar a você a capacidade de excluir certas informações sobre você dentro do Serviço.
              </p>
              <p>
                Você pode atualizar, alterar ou excluir suas informações a qualquer tempo fazendo login na sua Conta, 
                se você tiver uma, e visitando a seção de configurações da conta que permite gerenciar suas informações pessoais.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card className="mb-8" id="seguranca">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Segurança de Seus Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                A segurança de seus Dados Pessoais é importante para nós, mas lembre-se de que nenhum método de transmissão pela Internet 
                ou método de armazenamento eletrônico é 100% seguro. Embora nos esforcemos para usar meios comercialmente aceitáveis para proteger seus Dados Pessoais, 
                não podemos garantir sua segurança absoluta.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacidade de Menores */}
        <Card className="mb-8" id="criancas">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Privacidade de Menores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Nosso Serviço não se dirige a menores de 13 anos. Não coletamos conscientemente informações pessoalmente identificáveis de menores de 13 anos. 
                Se você é pai ou responsável e está ciente de que seu filho nos forneceu Dados Pessoais, entre em contato conosco.
              </p>
              <p>
                Se tomarmos conhecimento de que coletamos Dados Pessoais de menores de 13 anos sem verificação do consentimento dos pais, 
                tomamos medidas para remover essas informações de nossos servidores.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Links para Outros Sites */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Links para Outros Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Nosso Serviço pode conter links para outros sites que não são operados por nós. Se você clicar em um link de terceiros, 
                será direcionado para o site desse terceiro. Recomendamos fortemente que você revise a Política de Privacidade de cada site que visitar.
              </p>
              <p>
                Não temos controle e não assumimos responsabilidade pelo conteúdo, políticas de privacidade ou práticas de sites ou serviços de terceiros.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alterações */}
        <Card className="mb-8" id="alteracoes">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Alterações nesta Política de Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Podemos atualizar nossa Política de Privacidade de tempos em tempos. Notificaremos você sobre quaisquer alterações 
                publicando a nova Política de Privacidade nesta página.
              </p>
              <p>
                Informaremos você por email e/ou um aviso proeminente em nosso Serviço, antes da alteração entrar em vigor 
                e atualizaremos a data da "Última atualização" no topo desta Política de Privacidade.
              </p>
              <p>
                Recomendamos que você revise esta Política de Privacidade periodicamente para quaisquer alterações. 
                As alterações nesta Política de Privacidade são efetivas quando são publicadas nesta página.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card className="mb-8" id="contato">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Entre em Contato Conosco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>Se você tiver alguma dúvida sobre esta Política de Privacidade, pode entrar em contato conosco:</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
                <p className="flex items-center mb-0">
                  <Mail className="h-4 w-4 mr-2 text-blue-600" />
                  <strong>Por email:</strong> 
                  <a href="mailto:matheus.ramalho1354@gmail.com" className="ml-2 text-blue-600 hover:underline">
                    matheus.ramalho1354@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">
            © 2025 Agendamento ICVCG. Todos os direitos reservados.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-blue-600 hover:underline mr-4">
              Voltar ao Início
            </Link>
            <Link href="/profile" className="text-blue-600 hover:underline">
              Meu Perfil
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
