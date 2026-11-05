/** commands — le mince branchement de l'exécuteur, pour un robot donné :
 *  runCommand lit la table (vibeCommands), le catalogue (vibeActions), le
 *  relevé (lastView), puis appelle execute de core/commands avec les
 *  opérations existantes : start → startAction (vibe parti → vibeStart ; parti
 *  → refreshVibe, comme runVibeAction), direct → runDirect, run → runOp, proc
 *  → processOp. Aucune porte ne l'appelle.
 *  Ne connaît pas : la page, les portes (ni socket, ni boîte aux lettres), le
 *  choix du robot d'un dossier.
 *  Utilisé par : ses tests (le ticket suivant : les portes). */
import type { AgentConfig } from 'core/agents';
import type { CommandRequest, CommandResponse } from 'core/commands';

export async function runCommand(_agent: AgentConfig, _req: CommandRequest): Promise<CommandResponse> {
  throw new Error('not implemented');
}
