/** vibecoder — l'écran VibeCoder de l'agent affiché, que son fil montre sa session en cours
 *  ou une ancienne (l'historique de la Conversation ne ferme pas l'écran) : le relevé et
 *  tout ce que l'écran demande suivent l'agent affiché, et ce qu'il lui envoie va
 *  toujours à sa session en cours (sendToAgent : agent.sessionId), jamais à l'ancienne
 *  lue. Son relevé (le dépôt par
 *  git en lecture, la note, les tests de la branche, les sorties des skills,
 *  les validations → le parcours, core/vibecoder, un seul pour les deux rôles) part au panneau (`conv:vibe`)
 *  à chaque conversation envoyée (refreshConversation), toutes les 4 s tant
 *  que le panneau est visible, aussitôt après une action, une validation, un
 *  réglage — au plus un par seconde ; null, une fois, quand l'agent affiché
 *  n'est plus en VibeCoder ; chaque relevé retente la file d'attente
 *  (releaseWaits de controllers/runs). Le mode Vibe en cours (vibeOn de
 *  controllers/runs) part au parcours ; chaque relevé du créateur donne
 *  leur ✓ du système aux étapes faites (vibeMarks), Vibe en cours ou non (F-102) ;
 *  l'action vibe partie le lance (vibeStart). Et ce que l'écran demande : une action (celle d'une
 *  étape court à part, ownRun → startRun de controllers/runs, sous sa propre
 *  entrée du runtime, si aucune course en cours ne la retient ; une action sans
 *  étape est un message à l'agent affiché, comme s'il était tapé, par
 *  sendToAgent : refusé s'il travaille, I-25 ; ou, pour les actions de
 *  DIRECT_ACTIONS (commit, publish, load-pr, base, pr-here, pr-worktree,
 *  remove-worktree, stash, unload-pr, switch-branch, new-here, new-worktree, pull, rebase, push,
 *  fetch, request-review, assign-pr, unassign-pr, copy-artifact, add-artifact, rename-artifact, new-artifact-file,
 *  new-artifact-folder, trash-artifacts, move-artifacts, copy-artifacts, duplicate-artifacts), au clic de « direct » : leurs
 *  commandes, lancées par l'appli, F-114 ; copy-artifact : des artefacts du
 *  dernier relevé (args.artifacts), copiés par controllers/artifacts, I-39, un id inconnu refusé
 *  (unknown-artifact) avant la boîte de dialogue ; les sept autres actions sur
 *  les artefacts (args.artifacts, args.folder, args.name, args.names, rien d'autre lu ; rename-artifact : un seul
 *  id) vont à controllers/artifact-ops, qui revérifie tout ; add-artifact : un dépôt sur le
 *  panneau (dropOnArtifacts(paths, folder), les chemins lus du File par le pont ; le dossier : un id
 *  du relevé ; ou { name, content } d'un client sans disque, par la commande) : mêmes « en cours » et
 *  dernier résultat, sans la règle des courses ; leur fin est attendue (done) et leur refus rendu à
 *  la commande avec sa clé (refused, unknown-artifact, failed, name : invalid-args), pas seulement
 *  au relevé ; conv:vibeRun ne porte jamais de chemin, I-37, et le
 *  nom tapé y passe, sans canal de plus), une course (vibeRunOp : l'arrêter, la garder ou l'annuler, répondre
 *  à sa demande d'autorisation), un réglage (dont arrêter l'agent, comme Interrompre de son
 *  menu ; arrêter Vibe, la bannière : vibeStop de controllers/runs ;
 *  l'onglet Actions ouvert ou fermé : ses courses vues, runsTab de controllers/runs ;
 *  la vue des Modules, IDE ou liste : `modulesView`, 'ide' ou 'list' seulement, rangée
 *  dans les réglages, rendue au relevé : vibeModulesView ; la langue de l'écran est écrite par la page des réglages, plus ici),
 *  une validation (dont ✓ Rien à écrire, Créer : pour le texte de la note), le brouillon de revue, ouvrir un fichier ou un commit
 *  du relevé (dans l'éditeur, à une ligne ; la page d'un commit dans le
 *  navigateur, d'après l'origine GitHub du dépôt, I-32).
 *  Ne lit que la note et les tests que git donne dans le dossier de l'agent
 *  (safePath ; la note : parmi les fichiers changés, ou ceux de docs/tickets/ que
 *  git ignore, git.ignored puis locateNote, son « ignored » passé au parcours ;
 *  note 0.16.0-notes-hors-projet), et les sorties de cet agent sous leurs noms connus (isOutputName),
 *  dont toutes ses lectures d'invariants (invariants/<blob>.md : celle d'un
 *  test modifié depuis reste montrée, périmée, core/vibecoder) : une page
 *  désigne un fichier par son id dans le dernier relevé (lastView), jamais par
 *  un chemin (I-37). Le texte d'un test d'invariants à la base : par git seul (show au
 *  commit où la branche, ou la PR, part de repo.base : forkPoint, un par relevé ;
 *  null : absent là, pas de base ; au-delà de 200 Ko, core/vibecoder). Les fichiers d'un module
 *  touché : ceux que la branche change (core/vibecoder, d'après repo.changed),
 *  pas leur texte (controllers/module-code lit le fichier ouvert). Les
 *  artefacts du projet de l'agent (le dossier de son projet, controllers/artifacts ;
 *  leurs dossiers, même vides : VibeView.artifactDirs ;
 *  VibeView.artifactsDir le donne à la page pour le seul texte du `@`, aucun canal
 *  ne le reçoit en retour) : leur liste au relevé, sans leur texte ; ouverts ou copiés par leur id (a<i>)
 *  dans le dernier relevé, jamais par un chemin. Une action qui génère un module : sa course le retient
 *  (runModule → startRun). Ce qu'il écrit pour l'ouvrir (le diff d'un
 *  commit) va sous <sorties>/files/, en lecture seule. Le message d'une
 *  action : son gabarit, rempli par buildMessage (I-38 ; un argument inutile est
 *  ignoré, texte du champ compris si le gabarit n'a pas {{text}} — ignoredText —, rendu dans
 *  ignored pour l'orchestrateur, F-115), avec le préfixe des
 *  commandes vu de l'agent qui le reçoit ({{prefix}} : processes.promptPrefix) et la langue des agents
 *  ({{lang}} : agentLang, l'écran gardant vibeLang). Le modèle et l'effort d'une action : ceux de la configuration
 *  (actionPicks, jamais Fable, I-36), ceux qu'une page ou une demande en dit sont écartés (rendus dans ignored) ; le
 *  `who` des actions suit ce choix (whoOf). Les pièces du champ de l'action (args.pieces : sélection, fichiers, images) :
 *  préparées par prepareMessage (controllers/conversation) sur le texte du message et les seules clés connues, les images à part,
 *  si le gabarit lit {{text}} ou {{answers}} (sinon rendues dans ignored, rien préparé) ; un refus : l'erreur, rien
 *  n'est envoyé (I-2, élargi). git en lecture seule
 *  (technicals/git, I-39), sauf les actions directes (technicals/direct, la recette) ; gh aussi, sans agent (technicals/github, derrière
 *  le préfixe de l'agent : processes.agentPrefix) : Créer, la PR de la
 *  branche ; l'état de la PR suivie (60 s en cache, demandés en
 *  fond : le relevé ne les attend pas ; ↻ les redemande) et les PR ouvertes du
 *  dépôt, les miennes, à relire, toutes (setVibe({ prs })). Les sorties et les validations suivent la
 *  branche (followBranch), dans les deux rôles.
 *  Le rôle (créateur 'create', relecteur 'review' : VibeView.flow) ne se choisit pas : chaque relevé
 *  le recalcule (core/vibecoder vibeRole) d'après la PR du dossier (la PR suivie si le dossier est
 *  sur sa tête ou son robot, sinon la PR ouverte de la branche), ses personnes et mon identifiant (gh,
 *  en fond, 60 s en cache ; tant qu'ils manquent, le rôle rangé reste) et le range (vibe.flow) quand il
 *  change ; un `flow` envoyé par une page est ignoré (setVibe). Devenu relecteur sur la PR de la
 *  branche : sa fiche pr-<n>.json écrite et vibe.pr = n, rien de chargé. Relecteur : la copie de
 *  travail est comparée à origin/<base de la fiche pr-<n>.json> (note
 *  0.12.0-creer-relire-meme-dossier : la PR se charge dans ce dossier) ; une action `create` est
 *  refusée (startAction, d'après le dernier relevé, jamais la page), même demandée par
 *  l'orchestrateur. S'assigner la PR, Me retirer de la PR (assign-pr, unassign-pr : directes
 *  seulement, au clic) : la PR du dernier relevé, mon identifiant lu par gh, jamais un argument.
 *  La PR suivie (vibe.pr, load-pr réussi) et sa fiche : les deux rôles (la
 *  vue des branches). Au relevé, pour le parcours : le dossier
 *  (checkout : sa branche, ses modifications), les branches locales et l'état
 *  distant (git.branches, git.sync sur la base sans « origin/ » ; aucun fetch au
 *  relevé : seulement Actualiser, au clic), l'agent enfant d'un worktree
 *  (child), la recette de sa famille (controllers/recipe), la branche d'une
 *  nouvelle demande retenue (request). Chaque choix de lieu est une action
 *  directe, au clic seulement, jamais au relevé ni à la suite d'une autre :
 *  avant tout git switch (pr-here, unload-pr, switch-branch, new-here, base), git status relu,
 *  une ligne ou pas de réponse → refusé ; un changement de branche réussi oublie
 *  les derniers Rebase et Pousser ; switch-branch : une branche du relevé ;
 *  pull : git pull --ff-only --autostash ; rebase : origin/<base> rapatriée, ou
 *  une branche du relevé (onto) ; push : --force-with-lease ; pr-here : la tête de pr-<n>.json
 *  rapatriée puis git switch ; pr-worktree : la tête rapatriée, la recette
 *  (VIBECODER_BRANCH pr-<n>, VIBECODER_BASE la tête, départ origin/<tête>),
 *  puis le robot (controllers/worktrees prWorktreeReady : la question de
 *  confiance toujours, I-41) ; stash : git stash push -u, puis git status
 *  relu (propre : ok ; sinon l'échec), rien d'autre ne suit ; unload-pr : la
 *  base du dépôt, puis la PR plus suivie. Retirer le worktree
 *  (remove-worktree, directe seulement, jamais par l'agent) :
 *  controllers/worktrees ; celui d'une PR retiré, sa branche pr-<n> supprimée
 *  au dossier du parent (technicals/direct). Nouvelle demande (new-request, ou
 *  Rédiger la note sur la base en créateur) : la demande retenue en mémoire ; au
 *  relevé, <sorties>/new-request.json (la branche nommée par l'agent) supprimé
 *  et, avec une demande retenue, sa branche retenue avec elle (rien de créé au
 *  relevé). new-here, new-worktree (aussi Créer une branche) : le nom saisi
 *  (args.branch, pas une branche locale), sinon celui de la demande ; le départ
 *  args.start (une branche du relevé), sinon origin/<base> ; new-here : git switch
 *  -c <branche> <départ> ; new-worktree : le worktree, l'enfant (la question de
 *  confiance), affiché ; avec une demande retenue seulement, la note à rédiger (new-here) puis, au premier relevé hors de la base du dossier ou de
 *  l'enfant, Rédiger la note avec la demande.
 *  git manquant, dossier sans dépôt,
 *  fichier illisible : rien ne bloque le fil ni l'agent (I-29). L'onglet
 *  Processus (les commandes du projet, au relevé ; vibeProcess) :
 *  controllers/processes. Depuis les sources (app/dev) : ce qui a été
 *  reconstruit, au relevé (dev : devState) ; Recharger l'interface (reloadUi,
 *  pages seules reconstruites, pas pendant une dictée : reloadPages) ;
 *  Redémarrer (restartApp, principal reconstruit ; la question d'abord si un
 *  agent travaille).
 *  L'écran passe par le socket (0.15.0, controllers/socket : screenSend) : runVibeAction, vibeRunOp,
 *  draftVibe et dropOnArtifacts en sont les adaptateurs. Ils ne font que ce qui est propre à l'écran avant
 *  l'envoi — le choix « direct » (direct: true, retiré des arguments : la commande de l'action directe, sinon
 *  run.start, ou vibe, guide, new-request, propose-run), les chemins lus par le pont, les images des pièces
 *  en base64 (startAction les décode ; au plus 64 Mio décodés au total, sinon le refus ERRORS.heavyPieces, avant l'envoi : sous
 *  LINE_MAX, la connexion ne se ferme pas) — puis traduisent la réponse de l'exécuteur en texte (refusalText,
 *  ERRORS : la langue de l'appli). Les gardes (l'action au relevé, grisée, ce qui retient, un worktree, les
 *  arguments) restent à l'exécuteur et à startAction, runDirect. Sans socket : ERRORS.socket (runVibeAction,
 *  dropOnArtifacts), une boîte de message (vibeRunOp, draftVibe : muets sur un refus, rien n'est rendu à la
 *  page) ; jamais d'appel direct en repli. La file d'attente de l'agent (runs :
 *  releaseWaits) appelle startAction directement. Le brouillon de revue : editDraft, l'opération de
 *  l'exécuteur (relecteur, la PR suivie ; no-pr, args).
 *  Un refus de startAction ou de runDirect rend, à côté de son texte, sa clé (Refusal.reason :
 *  celle d'ERRORS, 'disabled' pour le grisé du relevé — runDirect refuse aussi une action grisée —,
 *  'same' | 'busy' | 'changing' avec by pour une course ou une action directe qui retient : lockCode ;
 *  runDirect exportée pour controllers/commands) ; runVibeAction et la page
 *  n'en voient que le texte, inchangé.
 *  surveyAgent : le relevé d'un robot quelconque (affiché : comme refreshVibe ; sinon retenu par lastView, rien envoyé à la page).
 *  Vérifier, puis valider la note (0.15.0, note skills-humain-ia ; 0.16.0 : deux gestes). Vérifier : l'action design-check
 *  par son canal (conv:vibeRun, runVibeAction ; proposée au relevé dès que la note est rédigée, relançable à volonté ;
 *  retenue par une course ou une action directe, busy ou changing : en file, queueStart de controllers/runs) ; au départ
 *  de sa course, quel que soit le geste qui la lance, l'empreinte de la conception de la note est gardée en mémoire
 *  (clicked). À chaque relevé, panneau visible ou non (T-31), la fin de la course design-check est rangée une fois
 *  (designEnd : la note vérifiée ; questions.md sans question, « rien de bloquant » : la marque 'verified' pour cette
 *  empreinte, sinon retirée), clicked oublié ; elle ne valide jamais la note et ne lance jamais le moteur. Valider la
 *  note (conv:vibeMark, markVibe) : une validation d'étape, aussitôt, aucune course, créateur comme relecteur ; elle ne
 *  lance jamais de vérification ; conv:vibeMark ne lit jamais un texte de la page.
 *  Les validations d'étape (0.15.0, note ecran-statuts) : markVibe sur 'note', 'forme', 'invariants', 'modules'
 *  (Valider la note, la forme, les invariants, les modules ; retirer : verdict null) et validateVibe (la CLI,
 *  step.validate : la Forme, les invariants, les modules, jamais la note) passent par validateStep (step-checks),
 *  d'après le contenu des étapes au dernier relevé (stepContent, ses blobs gardés en mémoire par agent) ; chaque
 *  validation écrit dans le dossier de sorties de l'agent (versionName) sa liste de fichiers (filesText) et le texte
 *  de chacun, jamais dans le dépôt ni sous .git/ ; l'index du dépôt n'est jamais touché. Au relevé, blobs : les
 *  fichiers des modules, les tests et ceux des listes retenues, leur empreinte sur le disque (blobSha du texte lu) et
 *  au dernier commit (gitReader.show('HEAD'), blobSha) ; validated : la liste retenue de chaque étape validée.
 *  Retirés : « file: », « step: », Revalider, gestureFiles, retainSteps.
 *  Les cas des invariants, un par un (0.15.0, note invariants-par-cas) : markVibe sur « case:<chemin>:<clé> » pose la
 *  marque de son bloc et du code commun (caseHashes, setCaseMark de core/vibecoder) ; au relevé, les validations d'avant,
 *  sur le fichier entier, converties sans bruit tant que le fichier n'a pas changé (convertCaseMarks, rangées une fois) ;
 *  la lecture à jour d'un test (son empreinte est celle du disque) retient l'empreinte du bloc de chaque cas lu à côté
 *  d'elle, et celle du code commun (<sorties>/invariants/<blob>.json, caseBlocks, écrit une fois), lue avec elle
 *  (ReadingRecord.blocks, common). Rien
 *  n'est écrit dans le projet.
 *  La note de référence du surlignage (0.15.0, note ecran-humain-ia ; core/vibecoder note-ref, en mémoire par agent) :
 *  posée une fois, au premier relevé où l'agent ou une course qui modifie la branche travaille (nextRef) ; ensuite
 *  remplacée seulement par Vu (setVibe seen) et la validation de la note (markVibe 'note' 'ok' : Valider, Revalider
 *  — la note du dernier relevé, celle que l'utilisateur avait sous les yeux au clic) ; repartie quand la note change de fichier. Un message envoyé, un tour ou une course
 *  qui commence ne la changent plus. Les actions en file d'attente (queuedOf de controllers/runs) partent au relevé
 *  (queued) : la page montre « en attente » à côté du bouton, design-check comprise.
 *  Le contrôle en trois points (0.16.0, note controle-en-trois-points) :
 *  - le moteur part seul, du seul Valider la note du créateur (markVibe 'note' 'ok', la note validée par ce clic), sa
 *    première validation (la note sans marque) ; revalidée en cours de parcours, elle retrouve son ✓ et le moteur ne repart
 *    que s'il enchaînait quand la pause de la note l'a arrêté (stoppedByNote de controllers/runs), sinon Reprendre : au
 *    relevé qui suit, puis à chaque relevé tant qu'elle n'est pas partie, l'action vibe est lancée comme un clic (startAction, vibeStart ; retenue :
 *    en file) ; le rythme de l'agent (expressOn de controllers/runs) part au parcours (express), et chaque relevé tient la
 *    pause (pauseVibe) ; setVibe({ express }) : le rythme réglé (setExpress), et, passé en express à une pause
 *    'invariants' ou 'modules' du dernier relevé, le moteur relancé ; jamais sans la note validée ; refusé « grisé » (le tour de la
 *    conversation finit encore) : retenté au relevé suivant (drive) ;
 *  - Vérifier, puis valider la note, deux gestes : Vérifier lance la vérification (l'action design-check) et ne valide
 *    rien ; Valider la note valide et ne vérifie rien ; la note du relevé porte ce
 *    qu'a rendu sa dernière vérification (verified : designState), d'après quoi la page montre ou non Valider la note
 *    (une règle d'affichage : markVibe ne refuse pas un Valider sans vérification) ; Vérifier n'envoie que le gabarit
 *    de la vérification, ni le texte du champ ni ses pièces jointes (I-2 ; tests/invariants/design-check-text.test.ts :
 *    son cas « Revérifier… » revient à son état d'avant le ticket, la retouche « un second Valider la note… » n'a plus
 *    lieu d'être ; ses deux autres cas partaient du premier Valider la note, qui ne lance plus rien : à reprendre pour
 *    partir de Vérifier, la règle inchangée, avec l'accord de l'utilisateur) ;
 *    la conception validée est retenue dans les sorties par Valider la note (validated/<empreinte>, comme les fichiers d'une
 *    étape), les « Accepter » d'avant oubliés ; à
 *    l'envoi des réponses (answers), les textes « Accepter » choisis sont gardés en mémoire (acceptedTexts, d'après les
 *    questions du dernier relevé) ; au relevé, la note changée garde son ✓ par keepNote seulement (sa conception retenue,
 *    ces textes), sinon il tombe ; aucun autre chemin ne valide la note à la place de l'utilisateur ;
 *  - les validations du système : vibeMarks à chaque relevé du créateur (plus seulement pendant Vibe), jamais le verdict
 *    d'un test (les notes de l'utilisateur) ; des tests changés après leur validation : pas revalidés au rythme par défaut,
 *    la pause 'invariants' revient (journey) et Reprendre à cette pause les valide (releasedPause de controllers/runs) ; step.validate
 *    (validateVibe) pose by: 'system', et refuse les modules (not-offered) tant que la preuve du dernier relevé
 *    (view.proof) n'est ni 'ok' ni 'none' ; le ✓ de l'écran (markVibe) reste à la main, sans by ; une validation retirée
 *    (markVibe ou step.validate, verdict null) tient pour ce contenu : le retrait est rangé dans les marques de l'agent
 *    (withdraw de core/vibecoder ; vibecoder-state.json, avec ses validations : il survit à un redémarrage de l'appli,
 *    aucune table en mémoire), le relevé (vibeMarks) ne la repose pas, ni celles des étapes qui la suivent, ni
 *    step.validate (withdrawn), tant que le contenu de l'étape ne change pas ; revalidée à la main : le retrait oublié ;
 *    tant que ce retrait tient, le relevé porte la pause 'withdrawn:<étape>' (journey) et pauseVibe arrête le moteur, en
 *    express aussi ; rien ne le relance seul à cette pause : ni le passage en express (setVibe : seules les pauses
 *    'invariants' et 'modules'), ni un Valider la note (drive : l'action vibe masquée par le parcours, la demande
 *    oubliée, pas retentée aux relevés suivants) ; la pause levée (le contenu changé, l'étape revalidée à la main),
 *    le moteur reste arrêté jusqu'au Reprendre de l'utilisateur ;
 *  - preuve.md : une sortie de branche de plus (BRANCH_OUTPUTS), lue au relevé comme align.md ; effacée par
 *    controllers/runs quand la course prove a touché le dossier de travail ou l'index ; align.md de même, effacé par
 *    controllers/runs quand la course align a changé un test d'invariant d'avant la branche.
 *  La revue essentielle (note 0.16.0-revue-essentielle), en relecteur :
 *  - une action part telle que son rôle la lance (roleDefs de core/vibecoder, d'après le dernier relevé, jamais la
 *    page) : l'alignement d'une PR est une lecture — sa course n'écrit que dans les sorties de l'agent (bounds.reads)
 *    et court avec les autres lectures ; le grisé d'une course (greyed, viewLocks de controllers/runs) suit la même règle ;
 *  - une lecture de la revue (READINGS de core/vibecoder) partie, quel que soit le geste (l'écran, la CLI, la file) :
 *    la PR et le commit de tête du relevé sont gardés en mémoire, par agent et par action ; à chaque relevé, panneau visible ou
 *    non, sa fin est rangée une fois (readEnd : finie, la marque « read:<pr>:<action> » pour cette PR et cette tête ; en échec, arrêtée,
 *    ou la tête pas retenue — l'appli relancée — : rien), puis oubliée ; conv:vibeMark ne pose jamais cette cible ;
 *  - rien ne lance une lecture ici : ni le relevé, ni le chargement d'une PR, ni la fin d'une autre lecture ; « Préparer
 *    la revue » est la page qui demande chaque lecture de view.prepare par conv:vibeRun, une demande par lecture.
 *  Ne connaît pas : la page (seulement ses canaux), la fenêtre, le jeton du socket.
 *  Utilisé par : app/ipc (runVibeAction, vibeRunOp, draftVibe, dropOnArtifacts), app/menus, controllers/conversation,
 *  controllers/runs, controllers/agents et controllers/module-code
 *  (lastView), controllers/artifacts et controllers/artifact-ops (lastView),
 *  controllers/commands (startAction, runDirect, editDraft, surveyAgent). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dialog, shell } from 'electron';
import type { SendResult, VibeAction, VibeArgs, VibeLang, VibeRunOp, VibeView } from 'shared/bridge';
import { EFFORTS, MODELS, MODES, type AgentConfig } from 'core/agents';
import { actionPicks, agentLang, agentList, agentVibe, vibeLang, vibeModulesView, type Config } from 'core/config';
import { agentParent } from 'core/family';
import { githubPage } from 'core/repo';
import { START, type CommandError } from 'core/commands';
import {
  acceptedTexts, addComment, artifactOf, caseBlocks, caseHashes, convertCaseMarks, setCaseMark, beforeOf, blobSha, buildMessage, designEnd, hasComment, keepNote, noteDesign, parseQuestions, skeletonMarks, vibeMarks, ARTIFACT_OPS, DIRECT_ACTIONS, DIRECT_ONLY, editComment, locateNote, headField, ignoredText, isInvariantTest, isOutputName, isTest, itemCommit, itemPath, nextRef,
  CHECKED, filesText, parseFiles, stepChecks, stepContents, validateStep, versionName, withdraw, withdrawn, type CheckedStep, type FileBlobs, type Marks, type StepContent, type StepFiles,
  blockedBy, BRANCH_CHANGES, READINGS, readEnd, roleDefs, lockCode, lockText, ELSEWHERE, json, newRequestCard, branchNoteKey, onBase, ownRun, prNumber, removeComment, runModule, runViews, safePath, setMark, skillModel, targetHash, vibeRole, vibeView, whoOf, type ActionDef, type MessageError, type NoteRef,
} from 'core/vibecoder';
import { draftText, isVerdict } from 'shared/review';
import { findEditor } from 'technicals/editor';
import { directRunner, prCardText, type DirectResult } from 'technicals/direct';
import { gitReader, gitRun, okRef } from 'technicals/git';
import { ghRun, githubReader } from 'technicals/github';
import { which } from 'technicals/paths';
import { devState, reloadPages, restartApp } from 'app/dev';
import { loadConfig, saveConfig, saveVibeStore, updateAgent, vibeActions, vibeOutDir, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { conversationShown, openConversation } from 'app/windows';
import { interruptAgent, isBusy, sendToAgent, setAgentSetting, viewAgent } from './agents';
import { agentPrefix, processAction, processView, promptPrefix, readFile, readTimed } from './processes';
import { addArtifacts, artifactFile, artifactFiles, copyArtifact, listArtifacts, projectArtifactsDir } from './artifacts';
import { copyArtifacts, duplicateArtifacts, moveArtifacts, newArtifact, renameArtifact, trashArtifacts } from './artifact-ops';
import { prepareMessage } from './conversation';
import { createWorktree } from './recipe';
import { SOCKET_DOWN, screenSend, socketDown } from './socket';
import { expressOn, lockingRuns, pauseVibe, viewLocks, queueStart, queuedOf, releaseWaits, releasedPause, runsOf, runsTab, setExpress, skillMd, startRun, stoppedByNote, vibeOn, vibeStart, vibeStop } from './runs';
import { openChild, prWorktreeReady, removeWorktreeChild, showWorktree, syncWorktrees, wantWorktree, worktreeParent, worktreeState } from './worktrees';

const VIBE_MS = 4000;          // le relevé régulier, panneau visible
const THROTTLE_MS = 1000;      // au plus un relevé par seconde
const TARGET_MAX = 300;        // une remarque du brouillon de revue : sa cible…
const REMARK_MAX = 5000;       // … et son texte
const GH_MS = 60_000;          // une réponse de gh vaut 60 s

const ERRORS: Record<VibeLang, Record<MessageError | 'agent' | 'action' | 'args' | 'noGit' | 'notRepo' | 'worktree' | 'socket' | 'heavyPieces' | 'noteOnBase', string>> = {
  fr: {
    agent: 'Aucun agent en VibeCoder dans le panneau.',
    action: 'Action inconnue ou indisponible.',
    args: 'Action refusée : arguments mal formés.',
    text: 'Dictez ou écrivez d\'abord dans le champ (20 000 caractères au plus).',
    module: 'Aucun module à générer : la Forme n\'en a plus, ou ce module n\'existe pas.',
    commit: 'Ce commit n\'est pas dans la branche.',
    pr: 'Indiquez une PR (son numéro).',
    answers: 'Aucune réponse à envoyer (50 réponses de 2 000 caractères au plus).',
    verdict: 'Choisissez : approuver, commenter ou demander des changements.',
    draft: 'Le brouillon de revue est vide.',
    files: 'Aucun test d\'invariant à lire (ou ce test n\'est plus dans la branche).',
    note: 'Pas encore de note pour cette branche.',
    repo: 'Pas de dépôt git dans ce dossier.',
    worktree: 'Un worktree reste sur sa branche : ni changer de branche, ni charger une autre PR.',
    socket: SOCKET_DOWN.fr,
    heavyPieces: 'Pièces jointes trop lourdes (64 Mio d\'images au plus).',
    noteOnBase: 'Sur la branche de base, Rédiger la note devient une nouvelle demande, envoyée à cette conversation, qui travaille encore : créez d\'abord la branche du ticket (git switch -c <type>/<ticket>-<slug>), puis relancez la note.',
    variable: 'Action mal écrite (variable inconnue), ou valeur refusée (caractère de contrôle) : voir le dossier de VibeCoder.',
    check: 'Cette vérification n\'est pas dans la dernière liste (checks.json).',
    noGit: 'git est introuvable : le parcours ne peut pas être lu. La conversation reste utilisable.',
    notRepo: 'Ce dossier n\'est pas un dépôt git : le parcours ne peut pas être lu. La conversation reste utilisable.',
  },
  en: {
    agent: 'No agent in VibeCoder in the panel.',
    action: 'Unknown or unavailable action.',
    args: 'Action refused: malformed arguments.',
    text: 'Dictate or type in the field first (20,000 characters at most).',
    module: 'No module to generate: the Shape has none left, or this module does not exist.',
    commit: 'This commit is not on the branch.',
    pr: 'Give a PR (its number).',
    answers: 'No answer to send (at most 50 answers of 2,000 characters).',
    verdict: 'Choose: approve, comment or request changes.',
    draft: 'The review draft is empty.',
    files: 'No invariant test to read (or this test is no longer on the branch).',
    note: 'No note for this branch yet.',
    repo: 'No git repository in this folder.',
    worktree: 'A worktree stays on its branch: no branch switch, no other PR loaded.',
    socket: SOCKET_DOWN.en,
    heavyPieces: 'Attachments too heavy (64 MiB of images at most).',
    noteOnBase: 'On the base branch, Write the note becomes a new request, sent to this conversation, which is still working: create the ticket\'s branch first (git switch -c <type>/<ticket>-<slug>), then start the note again.',
    variable: 'Badly written action (unknown variable), or refused value (control character): see the VibeCoder folder.',
    check: 'This check is not in the last list (checks.json).',
    noGit: 'git not found: the journey cannot be read. The conversation still works.',
    notRepo: 'This folder is not a git repository: the journey cannot be read. The conversation still works.',
  },
};

const last = new Map<string, VibeView>();  // le dernier relevé envoyé, par agent : ce que la page désigne
const noteRefs = new Map<string, NoteRef | null>();  // la note de référence du surlignage, par agent (core/vibecoder note-ref)
const ghCache = new Map<string, { at: number; value: unknown; pending: boolean }>();  // par question à gh
type GitState = { branches: string[] | null; sync: { behind: number | null; baseAhead: number | null } | null };
const gitCache = new Map<string, { key: string; at: number; value: GitState | null; pending: boolean }>();  // par agent : branches et sync
const directs = new Map<string, Record<string, NonNullable<VibeAction['direct']>>>();  // par agent : ses actions directes (F-114)
const prsFound = new Map<string, { mine: unknown[]; review: unknown[]; all: unknown[] } | false>();   // les PR ouvertes, par agent (la dernière réponse de gh ; false : en échec)
const requests = new Map<string, { text: string; branch?: string }>();  // new-request : la demande partie, par agent (en mémoire), puis sa branche
const clicked = new Map<string, string>();     // par agent : l'empreinte de la conception de la note au départ de la dernière course design-check, quel que soit le geste qui l'a lancée
const designSeen = new Map<string, number>();  // par agent : le départ de la dernière course design-check dont la fin est rangée
const noteSeen = new Map<string, number>();    // par agent : le départ de la dernière course Rédiger la note / Envoyer les réponses dont la fin est rangée
const chained = new Set<string>();             // la vérification de conception à lancer : la note rédigée ou répondue, plus aucune question (chain)
const readHeads = new Map<string, { pr: number; head: string }>();   // par agent et lecture de la revue (« agent\0action ») : la PR et le commit de tête du relevé d'où elle est partie
const readSeen = new Map<string, number>();    // … et le départ de la dernière course dont la fin est rangée (readEnd)
const engine = new Set<string>();              // le moteur (vibe) à lancer : la note validée pour la première fois (ou revalidée, lui arrêté par sa pause), ou passé en express à une pause
const accepts = new Map<string, string[]>();   // par agent : les textes « Accepter » choisis depuis la dernière validation de la note (answers)
// Par agent : la course forme suivie (son départ), les empreintes de ses fichiers de module au départ (null : pas vues),
// et si sa fin est rangée (les squelettes retenus, skeletonMarks).
const formeSeen = new Map<string, { since: number; before: Map<string, string | null> | null; done: boolean }>();
const firstNotes = new Map<string, string>();   // … puis par agent qui la prend (lui, ou l'enfant né d'elle) : sa note à rédiger, à son premier relevé
let shown: string | null = null;           // l'agent dont le panneau a le relevé (null : aucun, ou null envoyé)
let lastAt = 0;
let running: Promise<void> | null = null;   // le relevé en cours
let again = false;
let againNow = false;
let trailing: ReturnType<typeof setTimeout> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

// Le dernier relevé envoyé au panneau pour cet agent : ce que la page désigne par ses ids.
export const lastView = (agentId: string): VibeView | null => last.get(agentId) ?? null;

// gh : la dernière réponse à cette question (null : pas encore, ou échec) ;
// plus vieille que 60 s, ou jamais posée : redemandée en fond, et un relevé
// de plus si la réponse change. Le relevé n'attend jamais gh (I-29).
function fromGh<T>(key: string, ask: () => Promise<T | null>): T | null {
  const hit = ghCache.get(key);
  if (!hit || (!hit.pending && Date.now() - hit.at > GH_MS)) {
    if (ghCache.size > 200) ghCache.clear();
    const entry = { at: Date.now(), value: hit?.value ?? null, pending: true };
    ghCache.set(key, entry);
    ask().then((value) => {
      const changed = JSON.stringify(value) !== JSON.stringify(entry.value);
      Object.assign(entry, { value, pending: false, at: Date.now() });
      if (changed) refreshVibe({ now: true });
    });
  }
  return (hit?.value ?? null) as T | null;
}

// Les branches locales et l'état distant (git en lecture) : la dernière réponse pour ce HEAD et cette base ;
// HEAD ou la base changés (ou sa clé effacée : une action directe finie), plus vieille que 60 s, ou ↻ : redemandée en fond,
// et un relevé de plus si elle change. Le relevé ne les attend jamais (sous Windows, chaque git compte).
function fromGit(agentId: string, key: string, ask: () => Promise<GitState>): GitState | null {
  const hit = gitCache.get(agentId);
  if (!hit || (!hit.pending && (hit.key !== key || Date.now() - hit.at > GH_MS))) {
    const entry = { key, at: Date.now(), value: hit?.value ?? null, pending: true };
    gitCache.set(agentId, entry);
    ask().then((value) => {
      const changed = JSON.stringify(value) !== JSON.stringify(entry.value);
      Object.assign(entry, { value, pending: false, at: Date.now() });
      if (changed) refreshVibe({ now: true });
    });
  }
  return hit?.value ?? null;
}

// Les réponses de gh et de git redemandées au prochain relevé (↻).
const askAgain = () => { for (const entry of [...ghCache.values(), ...gitCache.values()]) entry.at = 0; };

// Relève l'agent affiché en VibeCoder et envoie son parcours au panneau ;
// sinon null, une fois. Un relevé à la fois, au plus un par seconde (sauf
// `now`, ou un autre agent) : le suivant attend ; un appel pendant un relevé
// se résout à sa fin (panelReady attend ainsi le premier). `fresh` (↻) : les
// réponses de gh sont redemandées.
export async function refreshVibe({ now = false, fresh = false }: { now?: boolean; fresh?: boolean } = {}) {
  if (fresh) askAgain();
  syncWorktrees(); // Relire dans un worktree : le robot temporaire arrive ou part (F-110)
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  const panel = state.panel && !state.panel.isDestroyed() ? state.panel : null;
  if (!agent || !panel) {
    if (timer) { clearInterval(timer); timer = null; }
    if (shown !== null) panel?.webContents.send('conv:vibe', null);
    shown = null;
    return;
  }
  // Toutes les 4 s, seulement panneau visible.
  timer ??= setInterval(() => { if (conversationShown()) refreshVibe(); }, VIBE_MS);
  // Panneau caché : aucun relevé ; il reprend à sa réapparition.
  // (sauf le premier relevé d'un agent qu'on vient d'afficher : le panneau peut ne pas être encore montré)
  if (!now && !conversationShown() && agent.id === shown) return;
  if (running) { again = true; againNow ||= now; return running; }
  const wait = now || agent.id !== shown ? 0 : lastAt + THROTTLE_MS - Date.now();
  if (wait > 0) { trailing ??= setTimeout(() => { trailing = null; refreshVibe(); }, wait); return; }
  shown = agent.id;
  lastAt = Date.now();
  running = (async () => {
    try {
      const view = await survey(agent, cfg);
      // Pendant le relevé, l'agent a pu changer de vue, ou le panneau d'agent.
      if (state.panel && !state.panel.isDestroyed() && viewAgent()?.id === agent.id) {
        last.set(agent.id, view);
        state.panel.webContents.send('conv:vibe', view);
        releaseWaits(agent, view);   // la file d'attente, d'après ce relevé
        firstNote(agent, view, cfg);
      }
    } catch (err) {
      console.error(`VibeCoder : relevé impossible (${err instanceof Error ? err.message : err})`);
    }
  })();
  await running;
  running = null;
  if (again) { const n = againNow; again = againNow = false; refreshVibe({ now: n }); }
}

// Le relevé de ce robot, affiché ou non, gh redemandé, retenu par lastView. Affiché : refreshVibe, la page suit ; sinon la
// page n'en reçoit rien (le relevé ne porte aucun jeton, et rien n'est envoyé : releaseWaits, firstNote restent à l'affiché).
// null : le relevé a échoué, ou la page n'est pas là.
export async function surveyAgent(agent: AgentConfig): Promise<VibeView | null> {
  if (viewAgent()?.id === agent.id) {
    await refreshVibe({ now: true, fresh: true });
    return lastView(agent.id);
  }
  askAgain();
  try {
    const view = await survey(agent, loadConfig());
    last.set(agent.id, view);
    return view;
  } catch (err) {
    console.error(`VibeCoder : relevé impossible (${err instanceof Error ? err.message : err})`);
    return null;
  }
}

/* ---- Le relevé ------------------------------------------------------------ */

// Un fichier du dossier de l'agent, s'il y reste (`..` et liens résolus).
function onDisk(dir: string, rel: string) {
  const file = safePath(dir, rel, fs.realpathSync.native);
  return (file && readFile(file)) ?? null;
}

// Les sorties des skills : chaque nom connu présent dans le dossier de sorties.
function readOutputs(out: string) {
  let names: string[] = [];
  try { names = fs.readdirSync(out); } catch { /* pas encore de sortie */ }
  return Object.fromEntries(names.filter(isOutputName).flatMap((name) => {
    const file = readTimed(path.join(out, name));
    return file ? [[name, file]] : [];
  }));
}

// Les skills du projet et de l'utilisateur : les dossiers de .claude/skills/ qui ont un SKILL.md.
function skillNames(dir: string) {
  const names = [path.join(dir, '.claude', 'skills'), path.join(os.homedir(), '.claude', 'skills')].flatMap((d) => {
    try { return fs.readdirSync(d).filter((name) => fs.existsSync(path.join(d, name, 'SKILL.md'))); }
    catch { return []; }
  });
  return [...new Set(names)].sort();
}

// Un nom de branche qu'un message peut porter, et git recevoir (okRef : [A-Za-z0-9._/-], ni « - » en tête, ni « .. »).
const branchName = (v: unknown) => (typeof v === 'string' && okRef(v) ? v : null);

// Les sorties que les skills écrivent pour une branche, dans les deux rôles (pas les lectures
// invariants/, nommées par l'empreinte du test, ni celles de la PR, par numéro).
// Les validations d'une branche quittée, rangées avec ses sorties (followBranch).
const MARKS_FILE = 'marks.json';
const BRANCH_OUTPUTS = ['questions.md', 'align.md', 'liens.md', 'preuve.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'ponytail-applied.json', 'pr.json', 'ci.md', 'ecran.md'];

// Les sorties suivent la branche : la dernière vue est dans
// <out>/.branche ; quand elle passe de P à N, celles de la racine vont dans
// branches/<P>/ (remplacé) — sauf si P est la base : une feature lancée depuis
// la base (Rédiger la note) crée sa branche et garde ce que ses
// skills ont écrit — puis celles de branches/<N>/, s'il existe, reviennent à
// la racine. Les validations de l'agent (agentId : ses marques) suivent de même, dans
// branches/<P>/marks.json : la note d'une nouvelle feature n'hérite pas du ✓ de la
// précédente (« modifiée depuis la validation » sans l'avoir jamais validée).
// Une erreur n'empêche pas le relevé (I-29).
export function followBranch(out: string, branch: string, base: string, agentId?: string) {
  const slug = (b: string) => path.join(out, 'branches', b.replace(/[^A-Za-z0-9._-]+/g, '-'));
  try {
    const mark = path.join(out, '.branche');
    const prev = fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8') : null;
    if (prev === branch) return;
    fs.writeFileSync(mark, branch);   // d'abord : un déplacement interrompu n'est pas refait par-dessus
    if (prev && prev !== base && !base.endsWith(`/${prev}`)) {
      const keep = slug(prev);
      fs.rmSync(keep, { recursive: true, force: true });
      fs.mkdirSync(keep, { recursive: true });
      for (const name of BRANCH_OUTPUTS) {
        if (fs.existsSync(path.join(out, name))) fs.renameSync(path.join(out, name), path.join(keep, name));
      }
      if (agentId) {
        const store = vibeStore();
        fs.writeFileSync(path.join(keep, MARKS_FILE), JSON.stringify(store.marks[agentId] ?? {}));
        delete store.marks[agentId];
        saveVibeStore(store);
      }
    }
    const saved = slug(branch);
    if (!fs.existsSync(saved)) return;
    for (const name of BRANCH_OUTPUTS) {
      if (fs.existsSync(path.join(saved, name))) fs.renameSync(path.join(saved, name), path.join(out, name));
    }
    if (agentId && fs.existsSync(path.join(saved, MARKS_FILE))) {
      const store = vibeStore();
      store.marks[agentId] = JSON.parse(fs.readFileSync(path.join(saved, MARKS_FILE), 'utf8'));
      saveVibeStore(store);
    }
    fs.rmSync(saved, { recursive: true, force: true });
  } catch { /* le relevé part quand même */ }
}

// Le dossier lui-même : sa branche, s'il a des modifications ; null si git ne répond pas.
async function checkoutOf(dir: string) {
  const run = gitRun(dir);
  const [branch, status] = await Promise.all([run(['rev-parse', '--abbrev-ref', 'HEAD']), run(['status', '--porcelain'])]);
  return branch === null || status === null ? null : { branch: branch.trim(), dirty: !!status.trim() };
}

// new-request.json au relevé : supprimé (une fois) ; avec une demande retenue, sa branche retenue avec elle
// (request au relevé, qui attend son choix : new-here, new-worktree ; rien de créé ici).
function takeRequest(agent: AgentConfig, text: string) {
  fs.rmSync(path.join(vibeOutDir(agent.id), 'new-request.json'), { force: true });
  const asked = requests.get(agent.id);
  const card = newRequestCard(text);
  if (asked && card) asked.branch = card.branch;
}

// Le premier relevé de l'agent qui prend une nouvelle demande (lui, ou l'enfant né d'elle) : Rédiger la note avec elle (retentée au relevé suivant si refusée, sauf invalide).
// Un relevé encore sur la base (parti avant le git switch) attend le suivant : sur la base, note serait une nouvelle demande.
function firstNote(agent: AgentConfig, view: VibeView, cfg: Config) {
  const text = firstNotes.get(agent.id);
  const def = text === undefined ? null : vibeActions(vibeLang(cfg)).find((a) => a.id === 'note');
  if (!def || onBase(view.repo?.branch ?? null, view.repo?.base ?? null)) return;
  const sent = startAction(agent, def, { text }, view, cfg);
  if (sent.ok || sent.invalid) firstNotes.delete(agent.id);
}

// Le dernier commit : l'empreinte d'un fichier à un commit (null : absent), retenue par dépôt, commit et chemin ;
// un commit ne change pas, git n'est donc lu qu'une fois par fichier et par commit.
// ponytail: un échec de git (délai) y est retenu comme une absence jusqu'au commit suivant ; borné, vidé au-delà de 5 000 entrées.
const headBlobs = new Map<string, string | null>();
// Les empreintes que le relevé a vues, par relevé : ce sur quoi un geste de validation juge (stepContent).
const viewBlobs = new WeakMap<VibeView, FileBlobs[]>();

// Les fichiers des étapes : ceux que change la branche (modules, tests) et ceux des listes retenues ; l'empreinte de leur texte
// sur le disque (déjà lu au relevé : read) et au dernier commit (git show, en lecture seule ; un git par fichier au plus,
// la première fois), par lots de FILE_GITS à la fois.
const FILE_GITS = 8;

// Un fichier que `read` refuse (au-delà de READ_MAX) : son empreinte tout de même, pour qu'il ne passe pas pour absent ;
// null : absent, un lien ou illisible. Les octets sont hachés tels quels, sans décodage en chaîne (la limite d'une chaîne V8).
export function bigBlob(dir: string, rel: string) {
  const file = safePath(dir, rel, fs.realpathSync.native);
  try { return file && fs.lstatSync(file).isFile() ? blobSha(fs.readFileSync(file)) : null; } catch { return null; }
}

async function fileBlobs(
  dir: string, git: ReturnType<typeof gitReader>, head: string, paths: string[], read: (rel: string) => string | null,
): Promise<FileBlobs[]> {
  if (headBlobs.size > 5000) headBlobs.clear();
  const one = async (rel: string): Promise<FileBlobs> => {
    const text = read(rel);
    const key = `${dir}\0${head}\0${rel}`;
    if (!headBlobs.has(key)) {
      const at = await git.show('HEAD', rel);
      headBlobs.set(key, at === null ? null : blobSha(at));
    }
    return { path: rel, disk: text === null ? bigBlob(dir, rel) : blobSha(text), head: headBlobs.get(key) ?? null };
  };
  const unique = [...new Set(paths)];
  const out: FileBlobs[] = [];
  for (let i = 0; i < unique.length; i += FILE_GITS) out.push(...await Promise.all(unique.slice(i, i + FILE_GITS).map(one)));
  return out;
}

// La liste retenue de chaque étape validée (la marque 'ok' et sa liste dans <sorties>/validated/) ; null : illisible.
// Aussi lue par module-code (le texte d'un fichier à la validation).
export function keptLists(out: string, marks: Marks): Partial<Record<CheckedStep, StepFiles | null>> {
  return Object.fromEntries((['forme', 'invariants', 'modules'] as const).flatMap((step) => {
    const mark = Object.hasOwn(marks, step) ? marks[step] : undefined;
    const name = mark?.verdict === 'ok' && mark.files ? versionName(mark.files) : null;
    const text = name ? readFile(path.join(out, name)) : null;
    return name ? [[step, text === null ? null : parseFiles(text)]] : [];
  }));
}

// Retient un texte dans <sorties>/validated/<empreinte> (adressé par son contenu : déjà là, rien à refaire) ; jamais dans le
// dépôt ni sous .git/. Une écriture qui échoue ne bloque rien : la version manquera au diff « Depuis la validation ».
function keep(out: string, hash: string, text: string) {
  const name = versionName(hash);
  if (!name) return;
  try {
    fs.mkdirSync(path.join(out, 'validated'), { recursive: true });
    fs.writeFileSync(path.join(out, name), text, { flag: 'wx' });
  } catch { /* EEXIST : déjà retenue ; autre échec : voir plus haut */ }
}

// Ce que valide une étape : sa liste (sous l'empreinte de sa marque) et le texte de chaque fichier (sous la sienne), le texte du
// disque s'il est celui que le relevé a vu (sinon le relevé suivant décoche l'étape). La note n'a aucun fichier.
function retain(agent: AgentConfig, step: CheckedStep, { files }: StepContent) {
  if (step === 'note') return;
  const out = vibeOutDir(agent.id);
  keep(out, blobSha(filesText(files)), filesText(files));
  for (const [rel, hash] of Object.entries(files)) {
    const text = onDisk(agent.dir, rel);
    if (text !== null && blobSha(text) === hash) keep(out, hash, text);
  }
}

// Valider (ok) ou retirer la validation (null) d'une étape pour le contenu du dernier relevé (validateStep), ses textes retenus ;
// false : refusé (rien à valider, l'étape d'avant pas cochée, ou un relecteur hors la note). Rien n'est écrit ailleurs que dans les
// marques et le dossier de sorties.
function markStep(agent: AgentConfig, view: VibeView, step: CheckedStep, verdict: 'ok' | null, by?: 'system'): boolean {
  if (step !== 'note' && view.flow !== 'create') return false;
  const store = vibeStore();
  const before = store.marks[agent.id] || {};
  const contents = stepContents(view, before, viewBlobs.get(view) ?? []);
  // Une validation retirée tient pour ce contenu, retenue parmi les marques (withdraw) : ni le relevé suivant (vibeMarks) ni
  // la CLI (by) ne la reposent ; seul le geste à la main l'oublie. La note : jamais validée par le système, aucun retrait retenu.
  const hash = contents[step]?.hash;
  if (verdict && by && hash && withdrawn(before, step) === hash) return false;
  const validated = validateStep(before, contents, step, verdict);
  if (!validated) return false;
  const marked = verdict && by ? { ...validated, [step]: { ...validated[step], by } } : validated;
  const after = step === 'note' ? marked : !verdict && hash ? withdraw(marked, step, hash) : !by ? withdraw(marked, step, null) : marked;
  if (verdict) retain(agent, step, contents[step]!);
  store.marks[agent.id] = after;
  saveVibeStore(store);
  return true;
}

async function survey(agent: AgentConfig, cfg: Config): Promise<VibeView> {
  const lang = vibeLang(cfg);
  const { flow, pr } = agentVibe(agent);
  const realpath = fs.realpathSync.native;
  const git = gitReader(gitRun(agent.dir));
  // La copie de travail, comparée à la base du dépôt : sa branche désigne la PR, donc le rôle.
  const here = await git.facts();
  const out = vibeOutDir(agent.id);
  if (here) followBranch(out, here.branch, here.base, agent.id);
  // L'état de la vérification de conception lu avant les sorties (voir check plus bas).
  const check = runsOf(agent).find((r) => r.id === 'design-check' && ['done', 'failed', 'stopped'].includes(r.state));
  const outputs = readOutputs(out);
  if (outputs['new-request.json']) takeRequest(agent, outputs['new-request.json'].text);
  const card = pr ? json(outputs[`pr-${pr}.json`]?.text) : null;
  // gh, sans agent, en fond (fromGh) : la PR de la branche (pas sur la base) ; l'état de la PR suivie ; les PR ouvertes
  // (setVibe({ prs })) ; ses personnes et mon identifiant.
  const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
  const feature = here && here.branch !== 'HEAD' && here.base !== here.branch && !here.base.endsWith(`/${here.branch}`)
    ? here.branch : null;
  const foundKey = `pr ${agent.dir} ${feature}`;
  const found = feature ? fromGh(foundKey, () => gh.prForBranch(feature)) : null;
  const state = card && pr ? fromGh(`state ${agent.dir} ${pr}`, () => gh.prState(pr)) : null;
  const worktree = worktreeState(agent, pr, !!directs.get(agent.id)?.['pr-worktree']?.running);
  // Le rôle (core/vibecoder role), recalculé à chaque relevé. Sa PR : la PR suivie si le dossier est sur sa tête (ou
  // son robot), sinon la PR ouverte de la branche. Tant que gh n'a pas répondu, le rôle rangé reste.
  const followed = !!pr && !!card && (here?.branch === card.head || !!worktree?.temp);
  const target = followed ? pr : found?.number ?? null;
  const people = target ? fromGh(`people ${agent.dir} ${target}`, () => gh.prPeople(target)) : null;
  const login = target ? fromGh(`login ${agent.dir}`, () => gh.login()) : null;
  const waiting = !followed && !!feature && !found && !!ghCache.get(foundKey)?.pending;
  const role = waiting ? flow : vibeRole({ open: (followed ? state ?? card?.state : found?.state) === 'OPEN', people, login, was: flow });
  if (role !== flow) patchVibe(agent.id, { flow: role });
  if (role !== flow && role === 'review' && !followed && found?.state === 'OPEN') {
    // Devenu relecteur sur la PR de sa branche : sa fiche écrite et suivie (rien de chargé) ; le relevé suivant la lit.
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `pr-${found.number}.json`), prCardText({ author: '', body: '', ...found }));
    patchVibe(agent.id, { pr: found.number });
    refreshVibe({ now: true });
  }
  // Relecteur : comparée à origin/<base de la fiche>.
  const base = branchName(card?.base);
  const facts = role === 'review' && followed && base && `origin/${base}` !== here?.base ? await git.facts(undefined, `origin/${base}`) : here;
  // Les branches locales et l'état distant (git en lecture, aucun fetch), en fond (fromGit) : sync prend la base sans « origin/ ».
  const syncBase = facts?.base.replace(/^origin\//, '') ?? null;
  const gitState = fromGit(agent.id, `${facts?.head ?? ''} ${syncBase ?? ''}`, async () => {
    const [branches, sync] = await Promise.all([git.branches(), syncBase !== null ? git.sync(syncBase) : null]);
    return { branches, sync };
  });
  const branches = gitState?.branches ?? null;
  const sync = facts ? gitState?.sync ?? null : null;
  const github = { pr: found, state, prs: prsFound.get(agent.id) ?? null };
  const repo = facts && { branch: (role === 'review' && followed && branchName(card?.head)) || facts.branch, base: facts.base, changed: facts.changed, dirty: facts.dirty, added: facts.added, commits: facts.commits };
  // La note du ticket : sa clé d'après la branche (ticket, sinon version, sinon son nom exact), parmi les .md de
  // docs/tickets/ que change la branche (ou la PR), ou, ignorée par git, celle nommée comme la branche (git échoue : aucune).
  // Un agent sur la PR qu'il suit (sa branche, ou le worktree de la PR sur une branche locale `pr-<n>`) : la branche de la
  // PR (head de sa fiche), pas le nom local, qui ne dit ni le ticket ni la note (vu sur gt-plugins, pr-774 →
  // feat/G2-6799-imagine-decision-model). Passé sur une autre branche, la PR gardée en mémoire ne compte plus.
  const onPr = !!pr && (followed || repo?.branch === `pr-${pr}`);
  const noteBranch = repo && ((onPr && branchName(card?.head)) || repo.branch);
  const key = noteBranch && branchNoteKey(noteBranch);
  const located = repo && noteBranch && key ? locateNote(repo.changed, await git.ignored('docs/tickets') ?? [], key, noteBranch) : null;
  const notePath = located?.path ?? null;
  // Chaque fichier du projet lu une fois par relevé (la note, les tests, les fichiers à revoir).
  const disks = new Map<string, string | null>();
  const diskOf = (rel: string) => { if (!disks.has(rel)) disks.set(rel, onDisk(agent.dir, rel)); return disks.get(rel) ?? null; };
  const noteText = notePath ? diskOf(notePath) : null;
  // Les tests de la branche, et leur empreinte, qui nomme leur lecture.
  const tests = (repo?.changed ?? []).filter(isTest).flatMap((p) => {
    const text = diskOf(p);
    return text === null ? [] : [{ path: p, blob: blobSha(text), text }];
  });
  // Le texte d'un test d'invariants à la base (par git seul, I-37) : au commit où la branche part de repo.base (forkPoint,
  // un par relevé, comme at.base de controllers/module-code) ; null : absent là, ou un variant ; absent : pas de base, inconnu (au-delà de 200 Ko : core/vibecoder).
  const fork = repo && tests.some((t) => isInvariantTest(t.path)) ? await git.forkPoint(repo.base) : null;
  const based = await Promise.all(tests.map(async (t) => ({ ...t, base: !isInvariantTest(t.path) ? null : fork ? await git.show(fork, t.path) : undefined })));
  // Toutes les lectures d'invariants : un test modifié depuis la sienne reprend la plus récente de son fichier,
  // périmée (caseReading, core/vibecoder). Les blocs lus (<blob>.json, { blocks: { clé: empreinte du bloc }, common :
  // empreinte du code commun } ; avant, { clé: empreinte } seul) : écrits une fois quand la lecture d'un test est à jour
  // (un .md à son empreinte), lus avec elle ; illisibles : sans blocs.
  const readDir = path.join(out, 'invariants');
  let names: string[] = [];
  try { names = fs.readdirSync(readDir); } catch { /* pas encore de lecture */ }
  for (const t of tests) {
    if (!isInvariantTest(t.path) || !names.includes(`${t.blob}.md`) || names.includes(`${t.blob}.json`)) continue;
    const { keys, blocks, common } = caseBlocks(t.text);
    try {
      fs.writeFileSync(path.join(readDir, `${t.blob}.json`), JSON.stringify({ blocks: Object.fromEntries(keys.map((k, i) => [k, blocks[i]])), common }));
      names.push(`${t.blob}.json`);
    } catch { /* I-29 */ }
  }
  const readings = names.filter((n) => isOutputName(`invariants/${n}`)).flatMap((n) => {
    const reading = readTimed(path.join(readDir, n));
    if (!reading) return [];
    const object = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
    const kept = object(names.includes(`${n.slice(0, -3)}.json`) ? json(readFile(path.join(readDir, `${n.slice(0, -3)}.json`))) : null);
    const byKey = object(kept?.blocks) ?? kept;   // l'ancien format : { clé: empreinte } seul, sans common
    const blocks = byKey ? Object.fromEntries(Object.entries(byKey).filter(([, v]) => typeof v === 'string')) as Record<string, string> : null;
    const common = typeof kept?.common === 'string' ? kept.common : null;
    return [{ blob: n.slice(0, -3), ...reading, ...(blocks && { blocks }), ...(common && { common }) }];
  });
  // La note de référence du surlignage (nextRef) : posée au premier relevé où l'agent ou une course qui modifie la
  // branche travaille ; ensuite seuls Vu et Valider la note la remplacent (setVibe, markVibe).
  const busy = isBusy(agent.id);
  const writing = busy || lockingRuns(agent.id).some((r) => !r.reads);
  const note = located && noteText !== null ? { ...located, text: noteText } : null;
  const ref = nextRef(noteRefs.get(agent.id) ?? null, note, writing);
  noteRefs.set(agent.id, ref);
  const store = vibeStore();
  // La vérification de conception finie (Vérifier, par l'écran, l'orchestrateur ou la file) : sa fin rangée une fois (designEnd),
  // à chaque relevé, panneau visible ou non (T-31) ; ses questions : celles de questions.md, lues avec les sorties après
  // l'état de la course (check) : la course écrit ses questions avant de finir, finie elle a donc les siennes. Jamais une
  // validation de la note, jamais le moteur.
  if (check && notePath && check.since !== designSeen.get(agent.id)) {
    designSeen.set(agent.id, check.since);
    const marks = store.marks[agent.id] || {};
    const questions = parseQuestions(outputs['questions.md']?.text ?? '').length;
    store.marks[agent.id] = designEnd(marks, { path: notePath, state: check.state as 'done' | 'failed' | 'stopped', questions, clicked: clicked.get(agent.id) ?? null });
    clicked.delete(agent.id);
    saveVibeStore(store);
  }
  // Rédiger la note ou Envoyer les réponses finie (créateur, la même course : runKey) : sa fin rangée une fois ; finie sans erreur, la
  // vérification de conception est à lancer (chain, au relevé qui suit : plus aucune question, la note pas validée). Vérifier en
  // chaîne (demandé le 27 novembre 2026) : sans plafond, la boucle s'arrête d'elle-même quand une vérification ne trouve plus rien ;
  // la fin d'une vérification ne relance jamais rien.
  if (role === 'create') {
    const run = runsOf(agent).filter((r) => r.id === 'note' || r.id === 'answers').at(-1);
    const ended = !!run && ['done', 'failed', 'stopped'].includes(run.state);
    // Le premier relevé de l'agent (l'appli relancée, des courses d'avant) : ce qui est déjà fini est de l'histoire, rien ne part.
    if (!noteSeen.has(agent.id)) noteSeen.set(agent.id, ended ? run!.since : -1);
    else if (ended && noteSeen.get(agent.id) !== run!.since) {
      noteSeen.set(agent.id, run!.since);
      if (run!.state === 'done') chained.add(agent.id);
    }
  }
  // Une lecture de la revue finie (l'écran, la CLI ou la file) : sa fin rangée une fois (readEnd), à chaque relevé, panneau visible
  // ou non ; finie, la marque de la tête retenue à son départ, sinon rien ; la tête oubliée. Rien n'est lancé ici.
  for (const run of runsOf(agent)) {
    const id = `${agent.id}\0${run.id}`;
    if (!READINGS.includes(run.id) || !['done', 'failed', 'stopped'].includes(run.state) || readSeen.get(id) === run.since) continue;
    readSeen.set(id, run.since);
    const marks = store.marks[agent.id] || {};
    const next = readEnd(marks, { action: run.id, state: run.state as 'done' | 'failed' | 'stopped', pr: readHeads.get(id)?.pr ?? null, head: readHeads.get(id)?.head ?? null });
    readHeads.delete(id);
    if (next !== marks) { store.marks[agent.id] = next; saveVibeStore(store); }
  }
  // La note validée puis changée : son ✓ suit la conception d'aujourd'hui si le changement n'y ajoute que des textes « Accepter »
  // choisis (answers) ; sinon il tombe au relevé (keepNote). Aucun autre chemin ne valide la note à la place de l'utilisateur.
  if (role === 'create' && noteText !== null) {
    const marks = store.marks[agent.id] || {};
    const mark = Object.hasOwn(marks, 'note') ? marks.note : undefined;
    const name = mark?.verdict === 'ok' ? versionName(mark.hash) : null;
    const design = noteDesign(noteText);
    const kept = keepNote(marks, { validated: name ? readFile(path.join(out, name)) : null, design, accepted: accepts.get(agent.id) ?? [] });
    if (kept !== marks) {
      store.marks[agent.id] = kept;
      keep(out, blobSha(design), design);
      saveVibeStore(store);
    }
  }
  const actions = vibeActions(lang);
  const skills = Object.fromEntries(actions.map((a) => [a.id, skillMd(a.text)]));
  // Le modèle d'une action qui court, ou d'un skill en sous-contexte ; envoyé à la conversation, celui de l'agent (null).
  // Seule une action à modèle fixé se choisit (config : actionPicks) : son who suit le choix.
  const modelOf = Object.fromEntries(actions.map((a) => [a.id,
    ownRun(a) || headField(skills[a.id], 'context') === 'fork' ? skillModel(skills[a.id]) : null]));
  const who = Object.fromEntries(actions.map((a) => [a.id, whoOf(skills[a.id], lang, modelOf[a.id] ? actionPicks(cfg, a.id) : undefined)]));
  const running = lockingRuns(agent.id);
  // Le dossier : d'après facts (même copie de travail) ; sans git, relu à part.
  const checkout = facts ? { branch: facts.branch, dirty: facts.dirty.length > 0 } : await checkoutOf(agent.dir);
  // Processus : les commandes du projet, leur état, la recette de la famille (controllers/processes).
  const proc = processView(agent, cfg);
  // Les validations (le créateur seul valide les étapes) : la liste retenue de chaque étape validée, et l'empreinte des fichiers
  // des étapes — ceux que change la branche (modules, tests) et ceux de ces listes.
  // Les validations de cas d'avant cette version, converties une fois (convertCaseMarks : rien à convertir, mêmes marques, rien rangé).
  const stored = store.marks[agent.id] || {};
  const current = convertCaseMarks(stored, tests);
  if (current !== stored) { store.marks[agent.id] = current; saveVibeStore(store); }
  const validated = role === 'review' || !facts ? {} : keptLists(out, current);
  const listed = Object.values(validated).flatMap((files) => Object.keys(files ?? {}));
  const blobs = role === 'review' || !facts ? [] : await fileBlobs(agent.dir, git, facts.head, [...(repo?.changed ?? []), ...listed], diskOf);
  const journey = vibeView({
    agentId: agent.id, lang, modulesView: vibeModulesView(cfg), flow: role, pr, people, login, vibe: vibeOn(agent.id), express: expressOn(agent.id),
    agent: { model: agent.model || '', effort: agent.effort || '', mode: agent.mode || 'default' },
    busy,
    running,
    runs: runViews(runsOf(agent), actions.map((a) => ({ id: a.id, label: a.label, who: who[a.id] }))),
    repo,
    error: repo ? null : !which('git') ? ERRORS[lang].noGit : role === 'create' ? ERRORS[lang].notRepo : null,
    note: note && { ...note, before: beforeOf(ref, note) },
    tests: based,
    readings,
    outputs,
    marks: current,
    blobs,
    validated,
    draft: role === 'review' && pr ? store.drafts[agent.id]?.[pr] || [] : [],
    worktree,   // Dans un worktree (pr-worktree, direct) en cours
    child: !!agentParent(agent),
    recipe: proc.recipe,
    checkout,
    request: requests.get(agent.id)?.branch ?? null,
    github,
    branches,
    sync,
    actions,
    queued: queuedOf(agent.id).map((q) => q.action),
    direct: directs.get(agent.id),
    who,
    model: modelOf,
    skills: skillNames(agent.dir),
    exists: (rel) => { const file = safePath(agent.dir, rel, realpath); return !!file && fs.existsSync(file); },
    now: Date.now(),
  });
  // Les squelettes de la Forme : au départ d'une course forme, les empreintes des fichiers de module ; à sa fin réussie, celles
  // qu'elle a laissées (skeletonMarks) : un fichier encore identique est « à générer » (journey : skeleton).
  const forme = runsOf(agent).filter((r) => r.id === 'forme').at(-1);
  if (forme && role === 'create') {
    const seen = formeSeen.get(agent.id);
    const paths = journey.modules.flatMap((m) => (m.files ?? []).filter((f) => !f.deleted).map((f) => f.path));
    if (seen?.since !== forme.since) {
      const disk = new Map(blobs.map((b) => [b.path, b.disk]));
      // Déjà finie quand on la voit (l'appli relancée, ou ce code nouveau) : rien de retenu, on ne sait pas ce qu'elle a écrit.
      const ended = forme.state !== 'running';
      formeSeen.set(agent.id, { since: forme.since, before: ended ? null : new Map(paths.map((p) => [p, disk.get(p) ?? null])), done: ended });
    }
    const now = formeSeen.get(agent.id)!;
    if (!now.done && forme.state === 'done') {
      now.done = true;
      const marks = store.marks[agent.id] || {};
      const next = skeletonMarks(marks, paths, blobs, now.before);
      if (next !== marks) { store.marks[agent.id] = next; saveVibeStore(store); }
    }
  }
  // Les étapes faites reçoivent leur ✓ du système (validateStep, by: 'system'), leurs textes retenus, Vibe en cours ou non (F-102) ;
  // jamais la note ; ni une étape dont la validation a été retirée à la main pour ce contenu, ni celles qui la suivent (withdrawn).
  {
    const marks = store.marks[agent.id] || {};
    // Reprendre à la pause après les invariants vaut « d'accord » : leurs tests d'aujourd'hui validés (vibeMarks, resumed).
    const next = vibeMarks(marks, journey, blobs, releasedPause(agent.id) === 'invariants');
    if (next !== marks) {
      const contents = stepContents(journey, next, blobs);
      for (const step of CHECKED) if (next[step] !== marks[step] && contents[step]) retain(agent, step, contents[step]!);
      store.marks[agent.id] = next;
      saveVibeStore(store);
    }
  }
  const artifactsDir = projectArtifactsDir(agent.dir);
  const { artifacts, dirs } = listArtifacts(agent.id, artifactsDir, cfg.artifactTextMax);
  const view = { ...journey, ...proc, artifacts, artifactDirs: dirs, artifactsDir, dev: devState() };
  viewBlobs.set(view, blobs);
  if (role === 'create') {
    pauseVibe(agent, view);   // la pause tenue arrête le moteur, comme le bouton Arrêter
    drive(agent, view, cfg);
    chain(agent, view, cfg);
  }
  return view;
}

// La vérification de conception partie seule après Rédiger la note ou Envoyer les réponses (chained) : seulement s'il ne reste
// aucune question (une laissée sans réponse : rien) et que la note, rédigée, n'est pas validée ; lancée comme un clic, retenue par
// une course : en file ; refusée « grisée » : retentée au relevé suivant.
function chain(agent: AgentConfig, view: VibeView, cfg: Config) {
  if (!chained.has(agent.id)) return;
  const def = vibeActions(vibeLang(cfg)).find((a) => a.id === 'design-check');
  const noteOk = view.steps.find((s) => s.id === 'note')?.check?.state === 'ok';
  if (!def || !view.note?.filled || view.questions.length || noteOk) { chained.delete(agent.id); return; }
  const sent = startAction(agent, def, {}, view, cfg);
  const held = (sent.reason === 'busy' || sent.reason === 'changing') && sent.by;
  if (held) queueStart(agent, def.id, {}, held);
  if (sent.ok || held || sent.reason !== 'disabled') chained.delete(agent.id);
}

// Le moteur parti seul : l'action vibe lancée comme un clic, à chaque relevé tant qu'elle n'est pas partie (engine : la note
// vient d'être validée, ou passé en express à une pause) ; retenue par une course : en file. Jamais sans la note validée.
// Refusée « grisée » (le tour de la conversation finit encore) : retentée au relevé suivant ; refusée autrement : plus rien ne la retiendrait.
function drive(agent: AgentConfig, view: VibeView, cfg: Config) {
  if (!engine.has(agent.id)) return;
  const def = vibeActions(vibeLang(cfg)).find((a) => a.id === 'vibe');
  const noteOk = view.steps.find((s) => s.id === 'note')?.check?.state === 'ok';
  // À la pause d'un ✓ retiré à la main, l'action vibe est masquée (journey) : la demande est oubliée, pas retentée une fois la pause levée.
  if (!def || !noteOk || vibeOn(agent.id) || view.pause?.startsWith('withdrawn:')) { engine.delete(agent.id); return; }
  const sent = startAction(agent, def, {}, view, cfg);
  const held = (sent.reason === 'busy' || sent.reason === 'changing') && sent.by;
  if (held) queueStart(agent, def.id, {}, held);
  if (sent.ok) vibeStart(agent);
  if (sent.ok || held || sent.reason !== 'disabled') engine.delete(agent.id);
  if (sent.ok) refreshVibe({ now: true });
}

/* ---- Ce que demande l'écran ------------------------------------------------ */

// Un refus : son texte, et sa clé (reason : celle d'ERRORS ; 'disabled', le grisé du relevé ; 'same' | 'busy' | 'changing' avec by,
// la course ou l'action directe qui retient). Les portes qui ne lisent que le texte (l'écran) ne la voient pas.
// done : la fin d'une action d'artefact (runDirect), son refus avec sa clé ; l'exécuteur l'attend avant de répondre.
export type Refusal = SendResult & { reason?: string; by?: string; done?: Promise<Refusal>; why?: string };
// L'écran ne voit que le texte du refus, pas sa clé.
const bare = ({ ok, error }: SendResult): SendResult => ({ ok, error });
const fail = (lang: VibeLang, key: keyof typeof ERRORS.fr): Refusal => ({ ok: false, error: ERRORS[lang][key], reason: key });

// Le texte d'un refus de l'exécuteur (core/commands), dans la langue de l'appli : celui que l'écran montrait avant le socket.
// mine : les actions directes de l'agent, pour la seule commande directe qui part : « une autre est en cours » en reste le
// texte d'ERRORS.action (une course, lockText).
export function refusalText(error: CommandError, lang: VibeLang, mine: Record<string, { running?: boolean }> = {}): string {
  const T = ERRORS[lang];
  const { code, details } = error;
  const text = (v: unknown) => (typeof v === 'string' && v ? v : error.message);
  switch (code) {
    case 'no-survey': return T.agent;
    case 'no-pr': return T.pr;   // le brouillon, sans PR suivie
    case 'not-offered': case 'unknown-command': return T.action;
    case 'invalid-args': {
      // La clé de l'argument (details.arg), sinon celle de la faute (« text: … », « args.text: … ») : son texte, sinon « mal formés ».
      const key = typeof details.arg === 'string' ? details.arg : /^(?:args\.)?(\w+)/.exec(String(details.fault ?? ''))?.[1];
      return key && Object.hasOwn(T, key) ? T[key as keyof typeof T] : T.args;
    }
    case 'disabled': case 'refused': return text(details.reason);
    case 'same': case 'changing': return lockText({ code }, lang);
    case 'busy': return mine[String(details.by)]?.running ? T.action : lockText({ code }, lang);
    case 'worktree': return T.worktree;
    case 'failed': return text(details.message);
    default: return error.message;
  }
}

// Une commande de l'écran, par le socket : sa réponse traduite en ce que l'écran montre ({ ok } et le texte du refus),
// ERRORS.socket si le socket est indisponible (jamais d'appel direct en repli).
async function viaSocket(agent: AgentConfig, command: string, args: unknown, mine?: Record<string, { running?: boolean }>): Promise<SendResult> {
  const lang = vibeLang(loadConfig());
  const answer = await screenSend(agent, command, args);
  if (!answer) return bare(fail(lang, 'socket'));
  return answer.ok ? { ok: true } : { ok: false, error: refusalText(answer.error, lang, mine) };
}

// Un dépôt sur la zone du panneau : les chemins lus du File par le pont (jamais donnés par la page), chacun un { path } ;
// add-artifact par le socket, avec le dossier d'arrivée (un id du relevé, revérifié par addArtifacts). Les gardes (l'agent,
// l'action au relevé, « en cours ») : celles de l'exécuteur ; en fond (track), la réponse vient à la fin de la copie (done),
// son refus avec son texte.
export async function dropOnArtifacts(paths: unknown, folder?: unknown): Promise<SendResult> {
  const agent = viewAgent();
  if (!agent) return bare(fail(vibeLang(loadConfig()), 'agent'));
  const files = Array.isArray(paths) ? paths.map((p) => ({ path: p })) : [];
  return viaSocket(agent, 'add-artifact', { files, folder: typeof folder === 'string' ? folder : undefined }, directs.get(agent.id));
}

// Les images des pièces, en octets décodés, au plus pour une action de l'écran : en base64 (×4/3) elles font ~85 Mi
// caractères sur le fil, sous LINE_MAX (128 Mi) avec de la marge pour le texte, la sélection et le JSON ; au-delà la
// connexion se fermerait, et l'écran dirait « socket indisponible » : le refus se fait ici, avant l'envoi (ERRORS.heavyPieces).
const PIECES_MAX = 64 * 2 ** 20;

// Les pièces de la page pour le socket : seulement images, files, selection (une clé que la page ajoute hors du champ
// est retirée, comme avant : le schéma la refuserait et toute l'action avec) ; les images, l'ArrayBuffer de la page en
// base64 pour le JSON du socket (startAction les décode). null : les images pèsent plus de PIECES_MAX, rien ne part.
const wire = (args: VibeArgs): VibeArgs | null => {
  if (!args.pieces || typeof args.pieces !== 'object') return args;
  const { images, files, selection } = args.pieces;
  const sizeOf = (i: { data: unknown }) => (i && typeof i.data === 'object' && i.data ? (i.data as ArrayBuffer).byteLength || 0 : 0);
  if (Array.isArray(images) && images.reduce((sum, i) => sum + sizeOf(i), 0) > PIECES_MAX) return null;
  const encode = (i: { data: unknown }) => (i && typeof i.data === 'object' && i.data ? { ...i, data: Buffer.from(i.data as ArrayBuffer).toString('base64') } : i);
  const pieces = { images: Array.isArray(images) ? images.map(encode) : images, files, selection };
  return { ...args, pieces: Object.fromEntries(Object.entries(pieces).filter(([, v]) => v !== undefined)) as never };
};

// Une action de l'écran (son id) : la commande du contrat par le socket, d'après le choix « direct » de l'écran
// (direct: true, retiré des arguments : la commande de l'action directe) — une action à course : run.start ; vibe, guide,
// new-request, propose-run : leur commande. Toutes les règles (l'action au relevé et active, les arguments, ce qui
// retient, un worktree) : celles de l'exécuteur et de ce qu'il appelle (startAction, runDirect) ; le relevé et le
// refus d'un vibe parti : runCommand.
export async function runVibeAction(id: unknown, args: unknown): Promise<SendResult> {
  const cfg = loadConfig();
  const lang = vibeLang(cfg);
  const agent = viewAgent(cfg);
  if (!agent) return bare(fail(lang, 'agent'));
  if (typeof id !== 'string' || id === 'add-artifact') return bare(fail(lang, 'action'));   // le dépôt seul (dropOnArtifacts) : conv:vibeRun ne porte jamais de chemin, I-37
  if (!args || typeof args !== 'object' || Array.isArray(args)) return bare(fail(lang, 'args'));
  const wired = wire(args as VibeArgs);
  if (!wired) return bare(fail(lang, 'heavyPieces'));
  const { direct, ...rest } = wired;
  if (direct === true && DIRECT_ACTIONS.includes(id)) return viaSocket(agent, id, rest, directs.get(agent.id));
  return START.includes(id) ? viaSocket(agent, id, rest) : viaSocket(agent, 'run.start', { action: id, ...rest });
}

// Le grisé que le relevé met d'une course : une action d'étape, le texte de blockedBy d'après les courses et actions
// directes du relevé ; une autre n'est jamais grisée par une course (le relevé la grise par « L'agent travaille » ou
// « une commande directe est en cours »), null. Partagée par startAction et runDirect : un grisé de course est revu sur
// l'état vivant (startRun, lockCode), les autres refusent.
export const greyed = (def: ActionDef, view: VibeView, lang: VibeLang) =>
  ownRun(def) ? blockedBy(def, viewLocks(view, vibeActions(lang)), lang) : null;

// Une action envoyée, au clic comme à la demande de l'orchestrateur (runs : releaseWaits) : grisée au
// relevé pour une autre raison qu'une course, refusée (une course, startRun la revoit sur l'état vivant :
// le relevé peut avoir un temps de retard) ; son gabarit rempli (I-38) ; une action d'étape court à
// part, les autres vont à la conversation. invalid : ses arguments ne vont pas, rien à retenter ;
// ignored : les arguments donnés qui ne servent pas à l'action, ignorés (buildMessage). checks (toutes les vérifications,
// sans `check`) lance aussi la course ponytail.
export function startAction(
  agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config,
): Refusal & { invalid?: true; ignored?: (keyof VibeArgs)[] } {
  const lang = vibeLang(cfg);
  if (DIRECT_ONLY.includes(def.id)) return fail(lang, 'action');   // seulement par l'appli (runDirect), jamais via l'agent
  if (def.flow === 'create' && view.flow === 'review') return fail(lang, 'action');   // le relecteur (le dernier relevé, pas la page) n'édite, ne génère ni ne commite
  if (agentParent(agent) && BRANCH_CHANGES.includes(def.id)) return { ...fail(lang, 'worktree'), invalid: true };   // un worktree reste sur sa branche
  // Rédiger la note sur la base, en créateur : la nouvelle demande (son skill nomme la branche, que l'utilisateur valide).
  if (def.id === 'note' && view.flow === 'create' && onBase(view.repo?.branch ?? null, view.repo?.base ?? null)) {
    // Elle va à la conversation de l'agent : pendant son tour (c'est lui qui la demande, par sa CLI), elle ne peut pas partir ;
    // le refus dit quoi faire (la branche d'abord), pas « L'agent travaille » (note fix/0.16.0-note-sur-la-base).
    if (isBusy(agent.id)) return { ...fail(lang, 'noteOnBase'), reason: 'disabled' };
    def = vibeActions(lang).find((a) => a.id === 'new-request') ?? def;
  }
  [def] = roleDefs([def], view.flow);   // en relecteur, une action d'étape ne fait que lire : l'alignement compris
  const shown = view.actions.find((a) => a.id === def.id);
  if (shown?.disabled && shown.disabled !== greyed(def, view, lang)) return { ok: false, error: shown.disabled, reason: 'disabled' };
  // Le modèle et l'effort d'une action : ceux de la configuration (jamais Fable, I-36), ce que la page ou la demande
  // en dit est écarté ; buildMessage les revoit contre l'action affichée, et ne les rend pas dans ignored (ils ne viennent pas de l'appelant).
  const { model: _model, effort: _effort, ...given } = args;
  const message = buildMessage(def, { ...given, ...actionPicks(cfg, def.id) }, {
    view, out: vibeOutDir(agent.id), lang: agentLang(cfg), prefix: promptPrefix(agent, cfg),
  });
  if ('error' in message) return { ...fail(lang, message.error), invalid: true };
  // Ignorés : ce que l'appelant a donné et que le gabarit ne lit pas ; model et effort donnés, toujours (la configuration décide).
  const notGiven = [...(message.ignored ?? []).filter((k) => k !== 'model' && k !== 'effort'),
    ...(['model', 'effort'] as const).filter((k) => args[k] !== undefined)];
  // Les pièces du champ (I-2 élargi) : la sélection et les chemins ajoutés au texte, les images à part, les bornes de
  // prepareMessage ; seulement les clés connues, et seulement si le gabarit les lit (sinon dites dans ignored). Un refus : rien ne part.
  let outgoing = { text: message.text, images: [] as { mediaType: string; data: string }[] };
  if (args.pieces !== undefined && !message.ignored?.includes('pieces')) {
    const { images, files, selection } = (args.pieces && typeof args.pieces === 'object' ? args.pieces : {}) as Partial<NonNullable<VibeArgs['pieces']>>;
    // Les images d'un client du socket sont en base64 (l'écran les y a encodées) : décodées ici, prepareMessage les lit en octets.
    const bytes = (i: { data: unknown }) => (typeof i?.data === 'string' ? { ...i, data: Buffer.from(i.data, 'base64') } : i);
    const ready = prepareMessage({ text: message.text, images: Array.isArray(images) ? images.map(bytes) : images, files, selection });
    if ('error' in ready) return { ok: false, error: ready.error, invalid: true };
    outgoing = ready.message;
  }
  const sent = ownRun(def) ? startRun(agent, def, outgoing, cfg, runModule(def.id, args, view.modules)) : sendToAgent(agent, outgoing, cfg);
  // Toutes les vérifications (pas une seule relancée) : la ponytail review part avec elles, en même temps (même verrou de
  // lecture) ; déjà en cours, startRun la refuse (same) : pas en double. C'est l'appli qui la lance, pas le skill par la CLI.
  if (sent.ok && def.id === 'checks' && args.check === undefined) {
    const ponytail = vibeActions(lang).find((a) => a.id === 'ponytail');
    if (ponytail) startAction(agent, ponytail, {}, view, cfg);
  }
  // Vérifier partie, quel que soit le geste (l'écran, l'orchestrateur, la file) : l'empreinte de la conception de la note du
  // relevé gardée en mémoire ; sa fin la lira (designEnd). Refusée (same : une course court déjà) : celle de la première reste.
  if (sent.ok && def.id === 'design-check' && view.note) clicked.set(agent.id, blobSha(noteDesign(view.note.text)));
  // Une lecture de la revue partie, quel que soit le geste : la PR et le commit de tête du relevé retenus, sa fin en dira la marque (survey).
  if (sent.ok && view.flow === 'review' && READINGS.includes(def.id)) {
    const tip = view.commits.at(-1)?.hash, pr = prNumber(view.loaded?.number);
    if (tip && pr) readHeads.set(`${agent.id}\0${def.id}`, { pr, head: tip }); else readHeads.delete(`${agent.id}\0${def.id}`);
  }
  // Dans un worktree, par l'agent : sa fiche pr-<n>-worktree.json attendue (syncWorktrees, la question de confiance).
  if (sent.ok && def.id === 'pr-worktree' && view.pr) wantWorktree(agent.id, view.pr.number);
  // Les réponses envoyées : les textes « Accepter » choisis tels quels sont gardés (acceptedTexts, d'après les questions du relevé),
  // pour que la note validée garde son ✓ si le changement n'ajoute qu'eux (keepNote).
  if (sent.ok && def.id === 'answers') accepts.set(agent.id, [...(accepts.get(agent.id) ?? []), ...acceptedTexts(view.questions, args.answers ?? [])]);
  // Nouvelle demande : la demande retenue ; une fiche d'avant et les derniers résultats de ses choix, oubliés.
  if (sent.ok && def.id === 'new-request') {
    fs.rmSync(path.join(vibeOutDir(agent.id), 'new-request.json'), { force: true });
    requests.set(agent.id, { text: args.text as string });
    for (const id of ['new-here', 'new-worktree']) delete directs.get(agent.id)?.[id];
  }
  const ignored = ignoredText(def, args) ? [...notGiven, 'text' as const] : notGiven.length ? notGiven : undefined;   // un texte que le gabarit ne lit pas : dit aussi (F-115)
  return ignored ? { ...sent, ignored } : sent;
}

// Les actions directes en cours de l'agent, comme des courses (elles lisent ou modifient la branche) : startRun les respecte ;
// pas un nouveau worktree (ELSEWHERE), qui travaille dans un autre dossier.
export const directLocks = (agentId: string, defs: ActionDef[]) => Object.entries(directs.get(agentId) ?? {})
  .filter(([id, x]) => x.running && !ELSEWHERE.includes(id)).map(([id]) => ({ id, reads: !!defs.find((d) => d.id === id)?.reads }));

const RUN_OPS: VibeRunOp[] = ['stop', 'keep', 'undo', 'allow', 'always', 'deny'];

// Une course de l'agent affiché (l'id de son action, jamais un chemin ni un texte) :
// l'arrêter, la garder ou l'annuler, répondre à sa demande d'autorisation (run.<op> par le socket, controllers/runs
// derrière l'exécuteur). Rien n'est rendu à la page : muet sur un refus, la boîte de message si le socket manque.
export async function vibeRunOp(id: unknown, op: unknown) {
  const agent = viewAgent();
  if (!agent || typeof id !== 'string' || !RUN_OPS.includes(op as VibeRunOp)) return;
  if (!await screenSend(agent, `run.${op}`, { action: id })) await socketDown(vibeLang(loadConfig()));
}

// Une action directe (F-114) : l'appli lance elle-même sa liste fermée de
// commandes (technicals/direct) ou la recette (controllers/recipe), sans agent,
// avec des valeurs du dernier relevé (la branche, la base de sa PR, la PR
// suivie, le brouillon, les branches locales), de la fiche pr-<n>.json (la tête de la PR), de la
// demande retenue (sa branche), de git (la base du dépôt) ou vérifiées (un
// numéro de PR entier, un verdict des trois). En fond, une à la fois par
// agent : « en cours » puis son résultat partent au relevé. Rien ne suit une
// action (load-pr charge et suit la PR, seulement). Avant tout git switch : git status relu ;
// une ligne, ou pas de réponse → refusé. Les actions d'artefacts (add-artifact, ARTIFACT_OPS) : leur
// fin dans done, un refus avec la clé de son DirectResult (reason) ; copy-artifact : un id inconnu
// (artifactFiles) refusé tout de suite, unknown-artifact, sans boîte de dialogue.
export function runDirect(agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config): Refusal {
  const { id } = def;
  const lang = vibeLang(cfg);
  const mine = directs.get(agent.id) ?? {};
  // Un worktree (enfant ou robot) reste sur sa branche, quel que soit l'écran (note 0.12.0-gestion-des-branches).
  if (agentParent(agent) && BRANCH_CHANGES.includes(id)) return fail(lang, 'worktree');
  const other = Object.entries(mine).find(([, x]) => x.running);
  if (other) return { ...fail(lang, 'action'), reason: 'busy', by: other[0] };
  // Une course vivante la retient comme une autre course (la règle de runs) ; pas un nouveau worktree (ailleurs).
  const running = lockingRuns(agent.id);
  const lock = ELSEWHERE.includes(id) ? null : lockCode(def, running);
  if (lock) return { ok: false, error: lockText(lock, lang), reason: lock.code, by: lock.by };
  // Grisée au relevé pour une autre raison qu'une course (comme startAction ; une course : la règle vivante ci-dessus l'a vue).
  const shown = view.actions.find((a) => a.id === id);
  if (shown?.disabled && shown.disabled !== greyed(def, view, lang)) return { ok: false, error: shown.disabled, reason: 'disabled' };
  const out = vibeOutDir(agent.id);
  const run = directRunner({ dir: agent.dir, out, prefix: agentPrefix(agent, cfg) });
  const n = prNumber((view.loaded ?? view.pr)?.number);   // la PR suivie et chargée (les deux rôles), sinon celle du relevé
  const refused = (line: string): DirectResult => ({ ok: false, line, detail: '' });
  const clean = async () => (await gitRun(agent.dir)(['status', '--porcelain']))?.trim() === '';
  const DIRTY = 'Refused: uncommitted changes in this folder (or no answer from git status): nothing done.';
  const NO_BASE = 'No base branch found for this repository: nothing done.';
  // La base du dépôt (origin/HEAD, sinon main ou master), sans « origin/ ».
  const repoBase = async () => (await gitReader(gitRun(agent.dir)).facts())?.base.replace(/^origin\//, '') || null;
  // La tête de la PR (de pr-<n>.json), rapatriée ; sinon le refus ou l'échec, à rendre.
  const fetchHead = async (pr: number): Promise<{ head: string; detail: string } | DirectResult> => {
    const head = branchName(json(readFile(path.join(out, `pr-${pr}.json`)))?.head);
    if (!head) return refused(`Refused: no safe head branch in pr-${pr}.json.`);
    const fetched = await run.fetchBranch(head);
    return fetched.ok ? { head, detail: fetched.detail } : fetched;
  };
  // Le dossier a changé de branche : les derniers Rebase et Pousser ne la concernent plus (Pousser ne la vise jamais).
  const moved = (r: DirectResult) => { if (r.ok) { delete mine.rebase; delete mine.push; } return r; };
  // Une branche locale du relevé (switch-branch, onto, start), ou rien de donné (undefined) ; sinon null.
  const local = (v: unknown) => (v === undefined || (typeof v === 'string' && view.branches?.includes(v)) ? v as string | undefined : null);
  const asked = requests.get(agent.id);
  let job: () => Promise<DirectResult>;
  if (id === 'commit') job = () => run.commit();
  else if (id === 'fetch') {
    // Actualiser : au clic seulement ; le relevé suit (track). Les listes de PR relues aussi (mon identifiant, puis
    // openPrs) : une PR qu'on vient de me demander de relire paraît dans « à relire » sans attendre.
    job = async () => {
      const r = await run.fetchAll();
      const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
      prsFound.set(agent.id, (await gh.openPrs(await gh.login())) ?? false);
      return r;
    };
  }
  else if (id === 'pull') job = () => run.pull();
  else if (id === 'push') job = () => run.push();
  else if (id === 'switch-branch') {
    const branch = local(args.branch);
    if (!branch) return fail(lang, 'args');
    job = async () => moved(await clean() ? await run.switchTo(branch) : refused(DIRTY));
  } else if (id === 'rebase') {
    // Sur origin/<base du dépôt> par défaut (rapatriée), ou sur une branche locale.
    const onto = local(args.onto);
    if (onto === null) return fail(lang, 'args');
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const f = await run.fetchBranch(base);
      return f.ok ? run.rebase(onto ?? `origin/${base}`) : f;
    };
  } else if (id === 'request-review') {
    // Une PR de Toutes les PR, ni des miennes ni déjà à relire ; mon identifiant lu par gh, puis gh pr edit ; les listes relues.
    const pr = prNumber(args.pr);
    const prs = view.prs || null;
    const has = (list: { number: number }[]) => list.some((p) => p.number === pr);
    if (!pr || !prs || !has(prs.all) || has(prs.mine) || has(prs.review)) return fail(lang, 'pr');
    job = async () => {
      const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
      const login = await gh.login();
      if (!login) return refused('No GitHub login (gh api user): nothing done.');
      const r = await run.requestReview(pr, login);
      if (r.ok) prsFound.set(agent.id, (await gh.openPrs(login)) ?? false);
      return r;
    };
  } else if (id === 'assign-pr' || id === 'unassign-pr') {
    // La PR du dernier relevé (jamais celle de la page), mon identifiant lu par gh, au clic seulement ; la PR relue après.
    const pr = prNumber(view.pr?.number);
    if (!pr) return fail(lang, 'pr');
    job = async () => {
      const login = await githubReader(ghRun(agent.dir, agentPrefix(agent, cfg))).login();
      if (!login) return refused('No GitHub login (gh api user): nothing done.');
      const r = await (id === 'assign-pr' ? run.assign(pr, login) : run.unassign(pr, login));
      const hit = ghCache.get(`people ${agent.dir} ${pr}`);
      if (hit) hit.at = 0;   // ses personnes redemandées : le rôle relu
      return r;
    };
  } else if (id === 'copy-artifact') {
    // Des ids du dernier relevé ; le dossier choisi dans la boîte de dialogue (controllers/artifacts, qui revérifie).
    if (!Array.isArray(args.artifacts)) return fail(lang, 'args');
    const ids = args.artifacts;
    // L'agent pas affiché : la copie (sa boîte de dialogue) ne se fait que sur l'écran de cet agent ; des ids valides ne sont pas « inconnus ».
    if (viewAgent()?.id !== agent.id) return { ok: false, error: 'Refused: the agent is not displayed.' };
    if (!artifactFiles(agent, ids)) return { ok: false, error: 'Refused: unknown artifact.', reason: 'unknown-artifact' };   // avant la boîte, rien « en cours »
    job = () => copyArtifact(agent, ids);
  } else if (id === 'add-artifact') {
    // Le dépôt (dropOnArtifacts : les chemins lus du File par le pont ; ou { name, content } d'un client sans disque) :
    // addArtifacts revérifie tout, le dossier d'arrivée aussi. Pas la règle des courses (ELSEWHERE : un autre dossier).
    const { files, folder } = args as unknown as { files?: unknown; folder?: unknown };
    job = () => addArtifacts(agent, files, folder);
  } else if (id === 'rename-artifact') {
    // Un seul id ; le nom tapé, revérifié par artifact-ops (comme tout ce qui suit : les valeurs passent telles quelles).
    if (!Array.isArray(args.artifacts) || args.artifacts.length !== 1) return fail(lang, 'args');
    const [one] = args.artifacts;
    job = () => renameArtifact(agent, one, args.name);
  } else if (id === 'new-artifact-file' || id === 'new-artifact-folder') {
    job = () => newArtifact(agent, args.folder, args.name, id === 'new-artifact-folder');
  } else if (id === 'trash-artifacts') {
    job = () => trashArtifacts(agent, args.artifacts, args.names);
  } else if (id === 'move-artifacts') {
    job = () => moveArtifacts(agent, args.artifacts, args.folder);
  } else if (id === 'copy-artifacts') {
    job = () => copyArtifacts(agent, args.artifacts, args.folder);
  } else if (id === 'duplicate-artifacts') {
    job = () => duplicateArtifacts(agent, args.artifacts);
  } else if (id === 'load-pr') {
    const pr = args.pr === undefined ? n : prNumber(args.pr);
    if (!pr) return fail(lang, 'pr');
    // Une PR d'un fork refusée ; la fiche et la tête, puis la base de la fiche (le relevé compare à origin/<base>).
    job = async () => {
      const same = await run.sameRepo(pr);
      if (!same.ok) return same;
      const r = await run.loadPr(pr);
      if (r.ok) patchVibe(agent.id, { pr });   // la PR suivie, les deux rôles
      const base = r.ok ? branchName(json(readFile(path.join(out, `pr-${pr}.json`)))?.base) : null;
      if (!base) return r;
      const f = await run.fetchBranch(base);
      return f.ok ? { ...r, detail: `${same.detail}\n\n${r.detail}\n\n${f.detail}` } : f;
    };
  } else if (id === 'publish') {
    if (!n) return fail(lang, 'pr');
    if (!isVerdict(args.verdict)) return fail(lang, 'verdict');
    if (!view.draft.length) return fail(lang, 'draft');
    job = () => run.publish(n, args.verdict, draftText(view.draft), view.pr?.url ?? '');
  } else if (id === 'pr-here') {
    if (!n) return fail(lang, 'pr');
    // La tête rapatriée, puis git switch (le dossier propre à cet instant) et git pull --ff-only origin <tête>.
    job = async () => {
      const f = await fetchHead(n);
      if (!('head' in f)) return f;
      const r = moved(await clean() ? await run.switchTo(f.head) : refused(DIRTY));
      if (!r.ok) return r;
      const p = await run.pullBranch(f.head);
      return p.ok ? r : p;
    };
  } else if (id === 'pr-worktree') {
    if (!n) return fail(lang, 'pr');
    // La tête rapatriée, le worktree pr-<n> depuis origin/<tête>, puis le robot (I-41).
    job = async () => {
      const f = await fetchHead(n);
      if (!('head' in f)) return f;
      const branch = `pr-${n}`;
      const r = await createWorktree(agent, { branch, base: f.head, start: `origin/${f.head}` }, cfg);
      if (r.ok && r.dir) await prWorktreeReady(agent, n, r.dir, branch);
      return { ok: r.ok, line: r.line, detail: f.detail };
    };
  } else if (id === 'stash') {
    // git stash push -u, puis le dossier relu : propre, ok ; sinon l'échec. Rien d'autre ne suit.
    job = async () => {
      const r = await run.stash();
      if (!r.ok || await clean()) return r;
      return { ...r, ok: false, line: 'Stash done, but this folder still has changes (or no answer from git status).' };
    };
  } else if (id === 'unload-pr') {
    // La base du dépôt, le dossier propre à cet instant ; puis la PR plus suivie.
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const r = moved(await clean() ? await run.switchTo(base) : refused(DIRTY));
      if (r.ok) patchVibe(agent.id, { pr: null });
      return r;
    };
  } else if (id === 'new-here' || id === 'new-worktree') {
    // Le nom saisi (pas une branche locale) l'emporte sur celui de la demande ; le départ : une branche locale, ou origin/<base>.
    const typed = args.branch === undefined ? undefined : branchName(args.branch);
    const start = local(args.start);
    if (typed === null || (typed && view.branches?.includes(typed)) || start === null) return fail(lang, 'args');
    const branch = typed ?? asked?.branch;
    if (!branch) return fail(lang, 'action');
    // La base du dépôt rapatriée, puis le choix. Sans demande retenue, rien ne suit (ni Créer, ni note).
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const f = await run.fetchBranch(base);
      if (!f.ok) return f;
      const from = start ?? `origin/${base}`;
      if (id === 'new-here') {
        // git switch -c <branche> <départ> (le dossier propre à cet instant) ; une demande : le dossier en Créer.
        const r = moved(await clean() ? await run.switchTo(branch, from) : refused(DIRTY));
        if (!r.ok || !asked) return r;
        requests.delete(agent.id);
        firstNotes.set(agent.id, asked.text);
        return r;
      }
      // Le worktree de la branche depuis son départ, l'enfant (la question de confiance), affiché ;
      // pas d'enfant (confiance refusée…) : la demande reste retenue ici.
      const r = await createWorktree(agent, { branch, base, start: from }, cfg);
      if (!r.ok || !r.dir) return { ok: r.ok, line: r.line, detail: f.detail };
      const child = await openChild(agent, r.dir, { name: branch, create: true });
      if (!child) return refused(`Worktree created (${r.dir}), but no agent opened there${asked ? ': the request stays here' : ''}.`);
      if (asked) {
        requests.delete(agent.id);
        firstNotes.set(child.id, asked.text);
      }
      openConversation(child.id);
      return { ok: true, line: r.line, detail: f.detail };
    };
  } else if (id === 'remove-worktree') {
    // Retiré, le worktree d'une PR emporte sa branche pr-<n>, au dossier du parent (hors de la recette).
    job = async () => {
      const pr = agentParent(agent)?.pr;
      const parent = worktreeParent(agent);
      const r = await removeWorktreeChild(agent);
      if (!r.ok || !pr || !parent) return { ...r, detail: '' };
      const d = await directRunner({ dir: parent.dir, out: vibeOutDir(parent.id), prefix: agentPrefix(parent, cfg) }).dropPrBranch(pr);
      return d.ok ? { ...r, detail: d.detail } : d;
    };
  } else {
    const branch = view.repo?.branch;
    const base = view.pr?.base || view.repo?.base.replace(/^origin\//, '');
    if (!branch || !base) return fail(lang, 'repo');
    job = async () => moved(await clean() ? await run.toBase(branch, base) : refused(DIRTY));
  }
  directs.set(agent.id, mine);
  // Fini, les branches et l'état distant relus (Actualiser, Pull, Rebase… : HEAD ne bouge pas toujours) ;
  // l'ancienne réponse reste affichée d'ici là.
  const finished = track(mine, id, () => job().finally(() => { const hit = gitCache.get(agent.id); if (hit) hit.key = ''; }));
  // Une action d'artefact : sa fin attendue par la commande (le fichier est là dès la réponse), son refus rendu avec sa clé ;
  // un échec sans clé (la fin qui lève) : refused. Les autres actions : rendues aussitôt, leur résultat au relevé seulement.
  if (id !== 'add-artifact' && !ARTIFACT_OPS.includes(id)) return { ok: true };
  return { ok: true, done: finished.then((r): Refusal => (r.ok ? { ok: true } : { ok: false, error: r.line, reason: r.reason })) };
}

// Les réglages de l'agent (le rôle calculé, la PR suivie), changés d'après ceux d'à cet instant.
function patchVibe(id: string, patch: Partial<ReturnType<typeof agentVibe>>) {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (agent) updateAgent(id, { vibe: { ...agentVibe(agent), ...patch } });
}

// Une action directe de l'agent : « en cours », puis son résultat (un échec inattendu : sa ligne), au relevé.
// Rend ce résultat (reason : la clé d'un refus d'artefact, que runDirect rend à la commande) ; ne rejette jamais.
async function track(mine: Record<string, NonNullable<VibeAction['direct']>>, id: string, job: () => Promise<DirectResult & { reason?: string }>) {
  mine[id] = { running: true, last: mine[id]?.last ?? null };
  refreshVibe({ now: true });
  const r = await job().catch((err): DirectResult & { reason?: string } => ({ ok: false, line: err instanceof Error ? err.message : String(err), detail: '' }));
  mine[id] = { running: false, last: { ...r, time: Date.now() } };
  refreshVibe({ now: true });
  return r;
}

// Redémarrer depuis les sources : si un agent travaille (son tour, une course), la question d'abord, une à la
// fois ; Non : rien.
let asking = false;
async function confirmRestart() {
  if (asking) return;
  const busy = agentList(loadConfig()).filter((a) => isBusy(a.id) || lockingRuns(a.id).length > 0);
  if (busy.length) {
    asking = true;
    const { response } = await dialog.showMessageBox({
      type: 'warning', buttons: ['Non', 'Oui'], defaultId: 0, cancelId: 0, title: 'Redémarrer',
      message: 'Des agents tournent : voulez-vous quand même redémarrer ?',
      detail: `${busy.map((a) => a.name || a.dir).join('\n')}\n\nLeurs tours en cours s'arrêtent ; leurs conversations reprennent après.`,
    }).finally(() => { asking = false; });
    if (response !== 1) return;
  }
  restartApp();
}

// Un réglage de l'écran : arrêter Vibe (la bannière : vibeStop,
// la course en cours finit), la PR suivie (pour
// l'agent) ; « Vu » (la note de référence devient
// l'actuelle) ; modèle, effort et mode comme son
// menu (une valeur hors de ses choix est ignorée) ; arrêter son tour, comme
// Interrompre de son menu ; le robot de la PR dans son worktree (l'afficher,
// ou le proposer à nouveau : jamais un chemin, F-110) ; les PR ouvertes du dépôt (gh,
// sans agent, les deux rôles ; un échec s'affiche à la place) ; l'onglet Actions ouvert
// (ses courses vues, controllers/runs) ou fermé — même l'écran déjà quitté ; depuis les sources (app/dev),
// Recharger l'interface (reloadUi, pas pendant une dictée) ou Redémarrer (restartApp).
export function setVibe(patch: unknown) {
  if (!patch || typeof patch !== 'object') return;
  const p = patch as Record<string, unknown>;
  if (p.runsSeen === false) runsTab(null);
  const agent = viewAgent();
  if (!agent) return;
  const vibe = agentVibe(agent);
  if (p.vibe === false) vibeStop(agent);
  // Le rythme (en mémoire, jamais dans les réglages) ; passé en express à une pause du dernier relevé : le moteur repart au relevé suivant.
  if (typeof p.express === 'boolean') {
    setExpress(agent, p.express);
    const pause = last.get(agent.id)?.pause;
    if (p.express && (pause === 'invariants' || pause === 'modules')) engine.add(agent.id); else if (!p.express) engine.delete(agent.id);
  }
  if (p.pr === null || prNumber(p.pr)) vibe.pr = p.pr as number | null;   // le rôle ne se choisit pas : un `flow` de la page est ignoré
  updateAgent(agent.id, { vibe });
  if (p.modulesView === 'ide' || p.modulesView === 'list') saveConfig({ vibeModulesView: p.modulesView });   // la vue des Modules, retenue ; autre valeur : ignorée
  if (p.seen === true) {
    const note = last.get(agent.id)?.note;
    if (note) noteRefs.set(agent.id, { path: note.path, text: note.text });
  }
  for (const [key, choices] of [['model', MODELS], ['effort', EFFORTS], ['mode', MODES]] as const) {
    if (choices.some(([value]) => value === p[key])) setAgentSetting(agent.id, key, p[key] as string);
  }
  if (p.interrupt === true && isBusy(agent.id)) interruptAgent(agent.id);
  if (p.worktree === true) showWorktree(agent);
  if (p.runsSeen === true) runsTab(agent.id);
  // Depuis les sources (app/dev) : les pages seules reconstruites → les fenêtres rechargées, le principal et les
  // agents continuent ; le principal reconstruit → l'appli relancée, confirmé si un agent travaille.
  if (p.reloadUi === true && devState() === 'reload' && !state.recording) reloadPages();
  if (p.restartApp === true && devState() === 'restart') void confirmRestart();
  if (p.prs === true) {
    const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, loadConfig())));
    gh.login().then((login) => gh.openPrs(login)).then((list) => {
      prsFound.set(agent.id, list ?? false);
      refreshVibe({ now: true });
    });
  }
  refreshVibe({ now: true });
}

// ✓, ✗ ou oublier (null), pour le contenu que l'utilisateur a sous les yeux. Une étape (note, forme, invariants, modules) :
// valider (ok) ou retirer la validation (null) par markStep, d'après le dernier relevé ; le ✗ de la note (À revoir du
// relecteur) : sa marque, pour l'empreinte de targetHash, comme toute autre cible ; un ✗ sur une autre étape : ignoré.
export function markVibe(target: unknown, verdict: unknown) {
  const agent = viewAgent();
  const view = agent && last.get(agent.id);
  if (!agent || !view || typeof target !== 'string' || (verdict !== 'ok' && verdict !== 'ko' && verdict !== null)) return;
  // Le ✗ de la note (À revoir du relecteur) n'est pas une validation d'étape : une marque comme les autres. Un ✗ sur une
  // autre étape : ignoré.
  const step = verdict === 'ko' && target === 'note' ? undefined : CHECKED.find((s) => s === target);
  // Un cas (« case:<chemin>:<clé> ») : ses empreintes d'après le relevé (bloc et code commun), pas un hash ; inconnu : ignoré.
  const kase = step || !target.startsWith('case:') ? null : caseHashes(view.invariants, target);
  const hash = step || target.startsWith('case:') ? null : targetHash(view, target);
  if (!step && !hash && !kase) return;
  if (step && verdict === 'ko') return;
  // Valider la note (Valider, Revalider) : la référence du surlignage devient la note du dernier relevé.
  if (target === 'note' && verdict === 'ok' && view.note) noteRefs.set(agent.id, { path: view.note.path, text: view.note.text });
  const store = vibeStore();
  if (step) {
    // La note déjà validée une fois (sa marque, même dépassée) : la revalider ne lance pas le moteur, sauf arrêté par sa pause.
    const first = !Object.hasOwn(store.marks[agent.id] || {}, 'note');
    const done = markStep(agent, view, step, verdict === 'ok' ? 'ok' : null);
    // Valider la note du créateur, par ce clic seul : sa conception retenue (keepNote la compare à la note d'après), les « Accepter »
    // d'avant oubliés. Aucune vérification, aucune course : un Valider comme les autres. Le moteur à lancer (drive, au relevé qui
    // suit) à la première validation seulement ; une revalidation en cours de parcours rend le ✓ et remet les choses comme avant
    // le changement de la note : il ne repart que s'il enchaînait quand la pause de la note l'a arrêté (stoppedByNote) ; arrêté
    // avant (une pause, Arrêter, l'appli relancée), il le reste, en express aussi : Reprendre.
    if (done && step === 'note' && verdict === 'ok' && view.flow === 'create' && view.note) {
      const design = noteDesign(view.note.text);
      keep(vibeOutDir(agent.id), blobSha(design), design);
      accepts.delete(agent.id);
      if (first || stoppedByNote(agent.id)) engine.add(agent.id);
    }
  }
  else if (kase) {
    store.marks[agent.id] = setCaseMark(store.marks[agent.id] || {}, target, kase, verdict);
    saveVibeStore(store);
  } else {
    const before = store.marks[agent.id] || {};
    store.marks[agent.id] = setMark(before, target, hash!, verdict);
    saveVibeStore(store);
  }
  refreshVibe({ now: true });
}

// La validation d'une étape par la CLI (step.validate, controllers/commands) : la Forme, les invariants, les modules
// (valider : ok ; retirer la validation : null), jamais la note ; le même geste que markVibe (markStep : validateStep, les textes
// retenus dans le dossier de sorties). Refus : reason 'step' (invalid-args), 'not-offered' (rien à valider, ou l'étape
// d'avant pas cochée), 'flow' (relecteur).
export function validateVibe(agent: AgentConfig, step: unknown, verdict: unknown): Refusal {
  const lang = vibeLang(loadConfig());
  const view = lastView(agent.id);
  if (!view) return fail(lang, 'agent');
  if ((step !== 'forme' && step !== 'invariants' && step !== 'modules') || (verdict !== 'ok' && verdict !== null)) return { ...fail(lang, 'args'), reason: 'step' };
  if (view.flow !== 'create') return { ...fail(lang, 'action'), reason: 'flow' };
  // Les modules : par la preuve qui passe seulement (view.proof : 'ok', ou 'none' sans ligne « → invariant »), en express aussi.
  const unproved = step === 'modules' && verdict === 'ok' && view.proof && view.proof.state !== 'ok' && view.proof.state !== 'none';
  if (unproved || !markStep(agent, view, step, verdict, 'system')) return { ...fail(lang, 'action'), reason: 'not-offered', why: notValidated(agent, view, step, !!unproved) };
  refreshVibe({ now: true });
  return { ok: true };
}

// Pourquoi step.validate est refusée, pour l'agent qui la demande (en anglais, comme la table des commandes) : la preuve
// qui manque, l'étape d'avant pas validée (laquelle, et à qui elle revient), rien à valider, ou le retrait à la main qui tient.
function notValidated(agent: AgentConfig, view: VibeView, step: CheckedStep, unproved: boolean): string {
  const marks = vibeStore().marks[agent.id] || {};
  const contents = stepContents(view, marks, viewBlobs.get(view) ?? []);
  const checks = stepChecks(marks, contents);
  const before = CHECKED.slice(0, CHECKED.indexOf(step)).find((s) => checks[s].state !== 'ok');
  if (before) {
    const state = checks[before].state ?? 'never validated';
    const whose = before === 'note' ? 'the note changed or was never validated, only the user validates it, on the screen'
      : before === 'invariants' && state === 'changed' ? 'its tests changed since their validation, the user looks at them and resumes at the pause after the invariants (Resume)'
        : 'the app validates it once it is done, unless the user withdrew its validation by hand';
    return `the ${before} step is not validated (${state}): ${whose}`;
  }
  // l'étape d'avant d'abord : une preuve ne vaut que sur des tests que l'utilisateur a laissés passer
  if (unproved) return `the proof has not passed (${view.proof?.state}): run prove, the modules are validated once every « → invariant » line of the note is proved`;
  const hash = contents[step]?.hash;
  if (!hash) return step === 'invariants' ? 'nothing to validate: a test is marked « À revoir » by the user, or the tests are not written' : 'nothing to validate for this step yet';
  if (withdrawn(marks, step) === hash) return 'the user withdrew this validation by hand and the step has not changed since: it is theirs to give back';
  return 'nothing to validate';
}

// Le brouillon de revue de la PR suivie, du relecteur : ajouter une remarque (sa cible, sur une ligne de 300 caractères
// au plus ; le texte du champ, 5 000), en changer le texte (mêmes limites) ou en retirer une. Sans PR suivie, ou en
// créateur : no-pr, rien d'écrit ; une cible ou un texte fautifs : args ; une remarque inconnue du brouillon
// (hasComment) à changer ou retirer : reason 'id' (invalid-args, arg id), rien d'écrit. L'opération de l'exécuteur (draft.add, draft.edit,
// draft.remove : controllers/commands) ; l'écran passe par draftVibe.
export function editDraft(
  agent: AgentConfig, op: { add: { target: unknown; text: unknown } } | { edit: { id: unknown; text: unknown } } | { remove: unknown },
): Refusal {
  const lang = vibeLang(loadConfig());
  const { flow, pr } = agentVibe(agent);
  if (flow !== 'review' || !pr) return { ...fail(lang, 'pr'), reason: 'no-pr' };
  const okText = (t: unknown): t is string => typeof t === 'string' && !!t.trim() && t.length <= REMARK_MAX;
  const store = vibeStore();
  const drafts = store.drafts[agent.id] || {};
  if ('add' in op && typeof op.add?.target === 'string' && op.add.target.length <= TARGET_MAX && !/[\r\n]/.test(op.add.target) && okText(op.add.text)) {
    store.drafts[agent.id] = addComment(drafts, pr, op.add.target, op.add.text);
  } else if ('edit' in op && Number.isInteger(op.edit?.id) && okText(op.edit.text)) {
    if (!hasComment(drafts, pr, op.edit.id as number)) return { ...fail(lang, 'args'), reason: 'id' };
    store.drafts[agent.id] = editComment(drafts, pr, op.edit.id as number, op.edit.text);
  } else if ('remove' in op && Number.isInteger(op.remove)) {
    if (!hasComment(drafts, pr, op.remove as number)) return { ...fail(lang, 'args'), reason: 'id' };
    store.drafts[agent.id] = removeComment(drafts, pr, op.remove as number);
  } else return fail(lang, 'args');
  saveVibeStore(store);
  refreshVibe({ now: true });
  return { ok: true };
}

// L'écran, relecteur : une remarque du brouillon ajoutée, modifiée ou retirée (draft.add, draft.edit, draft.remove par
// le socket ; les règles et les bornes : celles de editDraft, derrière l'exécuteur). Rien n'est rendu à la page : muet sur
// un refus, la boîte de message si le socket manque.
export async function draftVibe(op: unknown) {
  const agent = viewAgent();
  if (!agent || !op || typeof op !== 'object') return;
  const { add, edit, remove } = op as { add?: unknown; edit?: unknown; remove?: unknown };
  const [command, args] = add ? ['draft.add', add] : edit ? ['draft.edit', edit] : remove !== undefined ? ['draft.remove', { id: remove }] : [];
  if (command && !await screenSend(agent, command, args)) await socketDown(vibeLang(loadConfig()));
}

// Un fichier écrit pour être ouvert (le diff d'un commit) : <sorties>/<rel>, en lecture seule, remplacé s'il existe ; son
// dossier doit rester dans le dossier de sorties (`..`, ou un lien qui en
// sort : rien). Son chemin, ou null.
function writeForEditor(out: string, rel: string, text: string) {
  const target = path.resolve(out, rel);
  if (!target.startsWith(path.resolve(out) + path.sep)) return null;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const dir = safePath(out, path.relative(out, path.dirname(target)), fs.realpathSync.native);
    if (!dir) return null;
    const file = path.join(dir, path.basename(target));
    fs.rmSync(file, { force: true });
    fs.writeFileSync(file, text, { mode: 0o444, flag: 'wx' });
    return file;
  } catch { return null; }
}

// Processus : une commande du fichier du projet par son rang dans le dernier
// relevé (lancer, arrêter, relancer, son journal), ou le fichier du projet
// dans l'éditeur ; jamais un texte ni un chemin (controllers/processes).
export async function vibeProcess(op: unknown, index?: unknown) {
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view) return;
  await processAction(agent, cfg, op, index, view.processes ?? []);
  refreshVibe({ now: true });
}

// Un fichier ou un commit du relevé, par son id (jamais un chemin, I-37) :
// - un fichier (n, t…, v…, m…) dans l'éditeur, à `line` si
//   elle est donnée : celui du dossier de l'agent (safePath), dans les deux rôles ;
// - `c<rang>` : le diff du commit (git show), écrit dans <sorties>/files/<hash>.diff ;
// - `gh:c<rang>` : la page du commit sur GitHub, dans le navigateur, d'après
//   l'origine du dépôt (githubPage, I-32) ; sans origine GitHub, rien ;
// - `a<i>` : un artefact du projet de l'agent, dans l'éditeur (artifactFile : dans son dossier, sans lien).
export async function openVibeItem(id: unknown, line?: unknown) {
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view || typeof id !== 'string') return;
  const at = Number.isInteger(line) && (line as number) > 0 ? line as number : undefined;
  const open = (file: string | null) => { if (file) findEditor(cfg.editorCommand)?.openFile(file, at); };
  const out = vibeOutDir(agent.id);
  const git = gitReader(gitRun(agent.dir));
  const commit = itemCommit(view, id);
  if (/^a\d+$/.test(id)) open(artifactFile(agent.id, artifactOf(view, id)));
  else if (/^dir:a\d+$/.test(id)) {
    // Montrer dans le dossier : le gestionnaire de fichiers, le fichier choisi, jamais ouvert (un script se lancerait).
    const file = artifactFile(agent.id, artifactOf(view, id.slice(4)));
    if (file) shell.showItemInFolder(file);
  }
  else if (commit?.web) {
    const page = githubPage(agent.dir, readFile);
    if (page && /^[0-9a-f]{7,64}$/.test(commit.hash)) shell.openExternal(`${page}/commit/${commit.hash}`);
  } else if (commit) {
    const text = await git.commit(commit.hash);
    open(text === null ? null : writeForEditor(out, path.join('files', `${commit.hash}.diff`), text));
  } else {
    const rel = itemPath(view, id);
    if (rel) open(safePath(agent.dir, rel, fs.realpathSync.native));
  }
}
