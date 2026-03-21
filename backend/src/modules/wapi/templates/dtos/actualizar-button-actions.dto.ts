import { IsArray } from 'class-validator';

export type AccionBoton = 'INBOX' | 'BAJA' | 'IGNORAR';

export interface ButtonAction {
  payload: string;
  accion: AccionBoton;
  enviarConfirmacion: boolean;
}

export class ActualizarButtonActionsDto {
  @IsArray()
  buttonActions: ButtonAction[];
}
