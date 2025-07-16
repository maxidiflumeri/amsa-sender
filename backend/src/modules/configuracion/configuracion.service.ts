import { Injectable } from "@nestjs/common";
import { GuardarConfiguracionDto } from "./dto/guardar-config.dto";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ConfiguracionService {
    constructor(private prisma: PrismaService) { }

    async guardar(dto: GuardarConfiguracionDto) {
        const entradas = Object.entries(dto.valores);

        for (const [clave, valor] of entradas) {
            await this.prisma.configuracion.upsert({
                where: {
                    userId_scope_clave: {
                        userId: dto.userId,
                        scope: dto.scope,
                        clave,
                    },
                },
                update: { valor: String(valor) },
                create: {
                    userId: dto.userId,
                    scope: dto.scope,
                    clave,
                    valor: String(valor),
                },
            });
        }

        return { ok: true };
    }

    async obtener(scope: string) {
        const registros = await this.prisma.configuracion.findMany({
            where: { scope },
        });

        const resultado: Record<string, string> = {};
        for (const c of registros) {
            resultado[c.clave] = c.valor;
        }
        return resultado;
    }
}