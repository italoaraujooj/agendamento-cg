-- ============================================================
-- 026: Conteúdo inicial do Manual de Serviço — Multimídia
-- ============================================================
-- Fontes: PROCEDIMENTOS - MULTIMIDIA.pdf, FAQ e tutoriais do Holyrics
-- (holyrics.com.br), manual da Behringer X32 e o fluxo de transmissão
-- (USB da X32 → Reaper → ReaStream → OBS).
-- Só insere se o manual da Multimídia ainda estiver vazio (pode rodar de novo).
-- Depois, todo o conteúdo pode ser editado em /admin-escalas/manual.
-- ============================================================

DO $$
DECLARE
  m uuid := (SELECT id FROM ministries WHERE name = 'Multimídia' LIMIT 1);
BEGIN
  IF m IS NULL THEN
    RAISE NOTICE 'Ministério Multimídia não encontrado; nada a fazer';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM manual_checklist_items WHERE ministry_id = m)
     OR EXISTS (SELECT 1 FROM manual_troubleshooting WHERE ministry_id = m)
     OR EXISTS (SELECT 1 FROM manual_videos WHERE ministry_id = m) THEN
    RAISE NOTICE 'Manual da Multimídia já tem conteúdo; nada a fazer';
    RETURN;
  END IF;

  -- Checklist
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, NULL, 'Ao chegar', 'Desativar o alarme da igreja', NULL, 0);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, NULL, 'Ao chegar', 'Ligar as luzes do corredor final da igreja', 'Os interruptores ficam na coluna perto da porta.', 1);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, NULL, 'Ao chegar', 'Ligar os disjuntores', '1. Sala dos disjuntores.
2. Sala do palco (camarim).', 2);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, NULL, 'Ao chegar', 'Ligar o filtro de linha branco 1 (embaixo da mesa)', 'Ele já energiza a tela de retorno, a câmera e a TV box. A TV box precisa ser ligada no controle.', 3);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Ligar a mesa de som', 'Ligue a mesa antes de qualquer caixa ou amplificador, para evitar estalos no sistema de som.', 0);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Ligar os equipamentos do camarim', '1. Filtros de linha.
2. Bases dos microfones.
3. Amplificadores de fone (Power Play).
4. Direct box.', 1);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Conferir as pilhas dos microfones sem fio', 'Use o medidor de carga das pilhas. Se o nível estiver abaixo da metade, troque.', 2);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Ligar a caixa de retorno do pastor', NULL, 3);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Definir quem usa os microfones sem fio', 'O ideal é que os vocalistas com menor projeção vocal usem os sem fio, para facilitar a estrutura de ganho.

• Pergunte ao pregador do dia se ele vai usar um microfone de bastão ou o de lapela.
• Em eventos especiais (Rede S2, Entre Amigas, Cantata) os dois sem fio geralmente já têm destino: oriente o louvor a usar microfones com fio.', 4);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Conferir os instrumentos do dia', 'Só desmute cada canal quando o músico sinalizar que está tudo ok, para evitar o barulho da conexão dos cabos.', 5);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Ajustar o ganho de cada canal (por volta de -12 dB)', 'Na medida em que cada músico ficar pronto, regule o ganho: o sinal deve modular no verde e chegar no laranja.

NUNCA deixe nenhum canal clipar (atingir 0 dB, pico vermelho), nem os canais individuais nem o geral LR. Veja os vídeos de estrutura de ganho e de clipping na aba Vídeos.', 6);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Aumentar o volume da saída master (LR)', 'Em dias de Escola Bíblica, mantenha o volume baixo até o fim da aula (9h30). Combine com o louvor uma passagem de som "de verdade" às 9h30, com o volume real do culto.', 7);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Passagem de som com o volume real', 'É aqui que você descobre o volume real de cada canal e equilibra tudo. Não mexa mais no ganho, a não ser que identifique algum excesso ou falta.', 8);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Equalizar vozes e instrumentos', 'Guia de frequências:
• Abaixo de 100 Hz (sub-graves): força. Em excesso, som "embolado" (boomy).
• 100–250 Hz (graves): suavidade. Em excesso, "lama".
• 250–500 Hz (médios-graves): corpo. Em excesso, abafado.
• 500 Hz–2 kHz (médios): presença. Em excesso, nasal.
• 2–4 kHz (médios-agudos): ataque. Em excesso, som de rádio.
• 4–6 kHz (agudos): presença. Em excesso, microfonia.
• Acima de 6 kHz (extremos-agudos): ar e brilho. Em excesso, estridência.

Assista aos vídeos de equalização na aba Vídeos (de preferência com fone de ouvido).', 9);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Antes do culto', 'Colocar música ambiente quando a banda não estiver ensaiando', 'Normalmente o servo da projeção avisa, perto da contagem regressiva.', 10);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Ao final', 'Mutar todos os canais ao fim da última música', 'Domingo: depois da bênção apostólica, o louvor canta uma última música enquanto a igreja se confraterniza. Ao final dessa música, mute todos os canais.', 11);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Ao final', 'Desligar a caixa de retorno do pastor', NULL, 12);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Ao final', 'Desligar os equipamentos do camarim (NÃO desligar direto no disjuntor)', 'Nesta ordem:
1. Power Plays e direct box.
2. Bases dos microfones.
3. Filtros de linha (podem continuar conectados na tomada).
4. Disjuntores. Mantenha sempre ligado apenas o disjuntor da iluminação do camarim.', 13);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Ao final', 'Desligar a mesa de som', 'A X32 salva as configurações sozinha, mas pode levar até 1 minuto depois de muitos ajustes. Espere um pouco antes de desligar ou use "Safe Shutdown" na tela Setup.', 14);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Ligar o processador de vídeo e o computador da projeção', NULL, 0);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Abrir o Holyrics e o Lumikit', NULL, 1);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Ligar a TV de retorno e a TV box', 'Confirme se a TV de retorno está recebendo o sinal do Holyrics.', 2);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Ver as músicas do dia no Planning Center', 'Acesse services.planningcenteronline.com no dia em que você estiver servindo.', 3);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Preparar as letras no Holyrics', '1. Pesquise cada música na aba de letras do Holyrics e arraste a letra até a aba Mídia.
2. Se a letra não existir no Holyrics, abra a música no Planning Center (aba "Order" ou "Songs") e copie o texto do documento "Lyrics". Sem esse documento, use "Música → Pesquisar na Internet" dentro do Holyrics.
3. Para criar: "Novo → Música", cole a letra, deixe uma linha por verso e uma linha em branco entre as partes, remova marcações como CORO, REFRÃO e PRÉ-CORO, e salve.

Vídeo na aba Vídeos: "Como colocar novas letras de músicas no Holyrics".', 4);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Baixar mídias, avisos e cartela', '1. No Planning Center, veja se há cartela, avisos ou o vídeo do "Igreja em Movimento" da semana. Quando não estiver anexado, procure pela data (formato 00/00) na aba "Media".
2. Baixe os avisos marcados com o ícone de anexo e confira também o grupo de WhatsApp da multimídia (web.whatsapp.com).
3. Arraste os arquivos baixados para a aba Mídia do Holyrics.', 5);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Testar as letras e as mídias do dia', 'Teste todas as letras no tema escolhido e todas as mídias. Se aparecer algum erro, veja a aba Solução de problemas.', 6);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', 'Testar o controle das luzes', NULL, 7);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Antes do culto', '10 minutos antes: iniciar a contagem regressiva e apagar as luzes', 'No Holyrics: Ferramentas → Contagem regressiva.
Se a banda não estiver ensaiando, peça ao servo da mesa de som para colocar uma música ambiente.', 8);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Durante o culto', 'Passar as letras acompanhando a ordem do culto', 'Passe o slide normalmente na penúltima sílaba da última palavra em tela. Isso varia conforme o ritmo, o arranjo e o cantor.', 9);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Durante o culto', 'Acender as luzes do salão nos avisos e falas do pastor', 'Mantenha as luzes acesas até o louvor voltar a tocar. O sinal costuma ser quando a igreja termina de se sentar.', 10);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Durante o culto', 'Ficar atento ao pregador para imagens, vídeos e cartela', 'Exiba no momento em que o pregador pedir.', 11);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Durante o culto', 'Última música: apagar as luzes e subir um tema sem letra (F9)', 'Essa música não vem informada no Planning Center. Assim que a banda começar, apague as luzes e suba o tema sem letra (F9). Pesquise a letra assim que reconhecer a música e, se não encontrar, cadastre na hora.', 12);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Ao final', 'Acender as luzes e ativar o blackout do Lumikit', 'Ative o blackout (tecla espaço) antes de fechar o Lumikit.', 13);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Ao final', 'Fechar o Holyrics e as demais janelas e desconectar o WhatsApp Web', NULL, 14);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Ao final', 'Desligar a processadora de vídeo e o monitor', 'O monitor desliga pelo sensor no canto inferior direito.', 15);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Ao final', 'Confirmar que o gabinete está desligado', 'Depois, ajude os demais servos a desligar e cobrir os equipamentos da sala.', 16);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Ligar o computador e abrir o Reaper e o OBS', 'Abra primeiro o Reaper e depois o OBS.', 0);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Conferir se o Reaper está recebendo o áudio da mesa', 'O computador recebe pelo cabo USB da mesa o LR (som do culto) e o microfone que capta a igreja. Os medidores das trilhas no Reaper devem se mexer.', 1);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Conferir o OBS: áudio do Reaper, câmeras e cenas', 'O áudio chega do Reaper pelo ReaStream. O medidor no mixer de áudio do OBS deve se mexer junto com o Reaper.', 2);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Criar e agendar a transmissão no OBS', '1. Gerenciar transmissão → Nova transmissão.
2. Título: o do culto ou evento.
3. Miniatura: troque se o tema da transmissão mudou.
4. Horário: 10h ou 18h, conforme o culto.
5. Clique em "Agendar e selecionar transmissão".
6. Confira se título, horário e miniatura estão corretos.', 3);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Verificar as legendas vindas do PC da projeção', 'As legendas devem chegar automaticamente na transmissão.', 4);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Testar os vídeos de avisos', 'Confira se o vídeo aparece na transmissão, se o áudio funciona e se a proporção/tamanho está correta.

Se os vídeos não chegarem automaticamente do PC da projeção:
1. Baixe os vídeos de avisos antes do culto.
2. No OBS, abra a cena "Vídeos Segurança" e configure os vídeos nela.
3. Para ajustar ao tamanho da tela, selecione o vídeo e pressione Ctrl + F.
4. Teste cada vídeo antes do culto começar.', 5);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Configurar a TV do berçário', '1. Vá até o berçário e ligue a TV.
2. No OBS, clique com o botão direito na cena principal → Projetar → monitor do berçário.
3. Confira na TV do berçário se a imagem aparece corretamente.', 6);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Antes do culto', 'Conferência final antes do culto', 'Câmeras, áudio, legendas, vídeos de avisos, cenas do OBS, transmissão agendada e TV do berçário.

Não inicie o culto sem testar os vídeos e confirmar que estão funcionando.', 7);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Durante o culto', 'Iniciar a gravação antes da pregação', NULL, 8);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Durante o culto', 'Acompanhar áudio, imagem, legendas e vídeos', 'Fique de olho para identificar problemas cedo. Veja a aba Solução de problemas.', 9);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Ao final', 'Finalizar a gravação no OBS', NULL, 10);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Ao final', 'Conferir se o arquivo da gravação está na pasta Vídeos', NULL, 11);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Ao final', 'Enviar a gravação para o Google Drive da Multimídia', 'Confira se o upload foi concluído antes de desligar o computador.', 12);
  INSERT INTO manual_checklist_items (ministry_id, area_id, section, title, details, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Ao final', 'Desligar os equipamentos utilizados', 'Siga o procedimento de desligamento da multimídia.', 13);

  -- Solução de problemas
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Canal sem som', 'Confira, nesta ordem:
1. O canal está mutado? (botão MUTE aceso)
2. O fader do canal está levantado?
3. O canal está enviando para o geral? O botão do LR/"Stereo Bus" do canal precisa estar aceso.
4. Tem sinal no medidor de entrada? Se não tem, é antes da mesa: cabo, direct box ligada, instrumento ligado.
5. Microfone sem fio: pilhas (veja o medidor), receptor ligado, microfone ligado.
6. Microfone condensador precisa de phantom power (48V) no canal.', 0);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Estalo forte ao ligar o 48V (phantom power)', 'Sempre mute o canal ANTES de ligar ou desligar o 48V. Espere alguns segundos antes de mexer no ganho desse canal.', 1);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Microfonia (apito ou zumbido crescente)', '1. Abaixe imediatamente o fader do canal que está realimentando (geralmente um microfone perto de caixa ou retorno).
2. Afaste o microfone da frente das caixas e do retorno.
3. Reveja o ganho: ganho alto demais deixa o canal sensível à microfonia.
4. Na equalização do canal, faça um corte suave entre 2 e 6 kHz (a faixa onde a microfonia costuma aparecer).', 2);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Som distorcido ou estourado (clipping)', 'O medidor do canal ou do LR está chegando no vermelho (0 dB). Reduza o GANHO do canal (não só o fader) até o sinal ficar por volta de -12 dB, modulando no verde e chegando no laranja. Se for o LR, abaixe o master e reveja os canais mais altos.', 3);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Nos fones da mesa ouço só um canal (ou algo diferente do culto)', 'Algum botão SOLO está ativo. Aperte "Clear Solo", acima dos faders master, para limpar todos os solos de uma vez. O solo não muda o que a igreja ouve, só o que você escuta no fone.', 4);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Músico sem som no fone de ouvido', '1. Confira se o Power Play (amplificador de fone, no rack) está ligado.
2. Confira o volume do canal daquele músico no Power Play e o cabo do fone.
3. Na mesa, confira o envio (bus send) dos canais para a mix daquele fone.', 5);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'A mesa não responde aos botões e faders', 'A mesa pode estar travada (Console Lock). Segure o botão HOME por 3 segundos para destravar.', 6);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'A mesa está desconfigurada (alguém mexeu)', 'Existe uma cena base do culto salva na mesa. Na seção Scenes, carregue a cena base (confirme o nome com o líder antes). Na dúvida, chame o líder antes de recarregar qualquer cena: isso pode mudar todos os ajustes de uma vez.', 7);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Microfone sem fio cortando ou falhando', '1. Confira as pilhas pelo medidor. Abaixo da metade, troque.
2. Evite ficar longe ou atrás de obstáculos em relação ao receptor.
3. Se continuar, troque por outro microfone e avise o líder.', 8);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Erro de texto na letra', 'Clique na música com erro, depois no ícone de lápis para editar. Corrija o trecho e salve.', 0);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Letra muito pequena ou cortada', 'Clique com o botão direito no tema → Editar → em "Margem", aumente a margem dos quatro lados e salve. Veja o vídeo "Como formatar os textos do tema Holyrics" na aba Vídeos.', 1);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Letra muito clara ou difícil de ler', 'No tema, abra a aba "Efeito" (ao lado de Fonte e Alinhamento), aumente o "Contorno" e salve. Ou troque de tema e teste de novo.', 2);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Imagem muito justa ou pequena', 'Clique com o botão direito na imagem → Configurações → teste os modos Ajustar, Preencher e Estender até achar o melhor.', 3);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'A música não aparece na pesquisa', '1. Marque a opção "letra" abaixo do campo de busca para pesquisar por trechos da letra.
2. Se não existir, use "Música → Pesquisar na Internet" ou copie a letra do Planning Center e cadastre em "Novo → Música".', 4);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Vídeo com tela preta ou travando no Holyrics', '1. Confirme que o Holyrics instalado é a versão 64 bits.
2. Em Meus Vídeos → menu de três pontos do vídeo → editar propriedades, veja a resolução e o bitrate. O ideal é 1920×1080 com bitrate perto de 4000. Vídeos com bitrate muito alto ou em H.265 podem travar.
3. Para converter: clique com o botão direito no vídeo → editar → resolução/bitrate → forçar conversão.', 5);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Vídeo do YouTube não toca no Holyrics', 'O Holyrics não reproduz links do YouTube (política do YouTube). Baixe o vídeo antes do culto e coloque na aba Mídia.', 6);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics lento ou travando', '1. Arquivo → Configurações: desative fade in/out.
2. Arquivo → Configurações de Exibição: desative os efeitos de transição.
3. Evite temas com vídeo de fundo; prefira imagem ou cor sólida.
4. Feche outros programas abertos no computador.', 7);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'A projeção aparece na tela do computador (ou o telão repete a tela)', 'O Windows precisa estar no modo Estender. Pressione Windows + P e escolha "Estender". Veja o vídeo "Holyrics em duas telas" na aba Vídeos.', 8);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'TV de retorno sem a letra', '1. Confira se a TV de retorno e a TV box estão ligadas (a TV box liga no controle).
2. Se o retorno vem pela rede, no Holyrics vá em Ferramentas → Plugin Holyrics e confira se o servidor está iniciado; depois recarregue a página de retorno na TV box.
3. Se não voltar, avise no grupo da multimídia.', 9);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Aparece o slide de título/artista antes da letra', 'Esse slide não pode ser removido, mas dá para começar direto na letra com Shift + F5, ou com um duplo clique no primeiro parágrafo da letra.', 10);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'O erro continua', 'Peça ajuda no grupo da multimídia sem receio. Estamos todos aprendendo juntos :)', 11);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'OBS sem áudio (o Reaper está recebendo)', 'O áudio vai do Reaper para o OBS pelo ReaStream:
1. No Reaper, confira se o plugin ReaStream está ativo (não bypassado), em modo de envio (Send).
2. No OBS, na fonte de áudio que recebe o Reaper, abra Filtros e confira o filtro ReaStream em modo de recebimento (Receive), com o MESMO identificador usado no Reaper.
3. Confira se a fonte não está mutada no mixer de áudio do OBS.
4. Se ainda não vier, feche e abra o OBS (mantenha o Reaper aberto).', 0);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Reaper sem sinal da mesa', '1. Confira se o cabo USB da mesa está conectado no computador.
2. No Reaper: Options → Preferences → Audio → Device. A interface USB da X32 precisa estar selecionada.
3. Confira se as trilhas estão com o monitoramento de entrada ligado.
4. Se você reconectou o cabo USB com o Reaper aberto, feche e abra o Reaper.', 1);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Áudio fora de sincronia com o vídeo', 'No OBS: mixer de áudio → engrenagem → Propriedades avançadas de áudio. Ajuste o "Deslocamento de sincronia" (em ms) da fonte do Reaper até a boca e a voz baterem. Normalmente o áudio chega antes da imagem e precisa de atraso.', 2);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Áudio estourado ou distorcido na transmissão', 'O medidor do OBS está chegando no vermelho. Reduza o nível no Reaper (master) ou na fonte do OBS: os picos devem ficar por volta de -6 dB. Confira também se o LR da mesa não está clipando.', 3);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Transmissão travando (quadros perdidos)', 'Veja a barra de status do OBS:
• Quadros perdidos por REDE: problema de internet. Prefira cabo, feche downloads e outros vídeos e, se precisar, reduza o bitrate em Configurações → Saída.
• Quadros perdidos por CODIFICAÇÃO ou RENDERIZAÇÃO: o computador está sobrecarregado. Feche outros programas.', 4);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Câmera branca sem imagem', '1. Pegue o controle da câmera e aponte para ela.
2. Pressione "Network" e anote o IP atual da câmera.
3. No OBS, abra a configuração da câmera e troque o IP antigo pelo novo.
4. Confira se a imagem voltou.', 5);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Vídeos de avisos não chegam pela projeção', '1. Baixe os vídeos de avisos manualmente.
2. No OBS, use a cena "Vídeos Segurança" e configure os vídeos nela.
3. Selecione o vídeo e pressione Ctrl + F para ajustar à tela.
4. Teste cada vídeo (imagem, áudio e proporção) antes do culto.', 6);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'TV do berçário sem imagem', 'Confira se a TV está ligada. No OBS, clique com o botão direito na cena principal → Projetar → escolha o monitor do berçário de novo.', 7);
  INSERT INTO manual_troubleshooting (ministry_id, area_id, problem, solution, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Não acho o arquivo da gravação', 'No OBS: Configurações → Saída → Gravação → "Caminho da gravação" mostra a pasta onde os arquivos são salvos (o padrão é a pasta Vídeos).', 8);

  -- Vídeos
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Estrutura de ganho na Behringer X32', 'https://www.youtube.com/watch?v=CkzljlsH88c', 'Como ajustar o ganho de cada canal na nossa mesa.', 0);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'O que é clipping? Entendendo o clipping de amplificadores e sinais', 'https://www.youtube.com/watch?v=-_v_jf3cIFc', 'Por que nunca deixar um canal chegar a 0 dB (vermelho).', 1);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Aprenda a equalizar vocais: zonas de frequência da voz', 'https://www.youtube.com/watch?v=PSyiqumF96I', 'Assista de preferência com fone de ouvido.', 2);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Som'), 'Equalização: o que é e como equalizar', 'https://www.youtube.com/watch?v=IZFFHcGaWV8', NULL, 3);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Como colocar novas letras de músicas no Holyrics', 'https://www.youtube.com/watch?v=PAN7LYQ7sCk', 'Cadastrar uma música que ainda não existe no Holyrics.', 0);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Como formatar os textos do tema no Holyrics', 'https://www.youtube.com/watch?v=xNLYQnC4l4g', 'Margem, tamanho e contorno da letra.', 1);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics: teclas de atalho', 'https://youtu.be/mYCt3DR24OU', 'Canal oficial do Holyrics.', 2);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics: contagem regressiva', 'https://youtu.be/9lthgOzp1wE', 'Canal oficial do Holyrics.', 3);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics: mídias (vídeos, imagens e áudio)', 'https://youtu.be/pAC4auhBbts', 'Canal oficial do Holyrics.', 4);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics: edição em tempo real', 'https://youtu.be/bktAZwjIH7c', 'Corrigir a letra durante o culto. Canal oficial do Holyrics.', 5);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics: visão do palco (retorno)', 'https://youtu.be/HBrYqH2eDSc', 'Como funciona a tela de retorno. Canal oficial do Holyrics.', 6);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Projeção'), 'Holyrics em duas telas', 'https://youtu.be/zokuJzx3hkM', 'Quando a projeção aparece no lugar errado. Canal oficial do Holyrics.', 7);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Integrando o Holyrics na transmissão ao vivo (OBS Studio)', 'https://www.youtube.com/watch?v=0mw7nurNzds', 'Canal oficial do Holyrics.', 0);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Holyrics: inserção de legendas na transmissão ao vivo', 'https://www.youtube.com/watch?v=zS7528-YrOE', 'Como as legendas chegam do PC da projeção.', 1);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'ReaRoute e ReaStream: levando o áudio do Reaper para o OBS (em inglês)', 'https://www.youtube.com/watch?v=OnfTq8EtluU', 'A partir de 7:31: como o ReaStream manda o áudio do Reaper para o OBS. Legendas automáticas disponíveis.', 2);
  INSERT INTO manual_videos (ministry_id, area_id, title, url, description, order_index) VALUES (m, (SELECT id FROM areas WHERE ministry_id = m AND name = 'Transmissão'), 'Guia rápido do OBS Studio (texto, em inglês)', 'https://obsproject.com/kb/quick-start-guide', 'Documentação oficial do OBS.', 3);
END $$;
