import { describe, expect, it } from 'vitest';
import { resumeAfterWatch, trackAudio, trackLabel, trackTap } from '../trackAudio';

/* After Day, 29-oct (pedido de Esteban: «no lo puedo frenar»): la tarjeta es un play/pausa del audio de fondo y «Ver» del track
   que sonaba no lo reanuda al cerrar. */

const vid = (id: string) => ({ id, title: id });

describe('trackAudio', () => {
  it('el track con el fondo de After Day: sonando o en pausa', () => {
    expect(trackAudio({ video: vid('a'), playing: true, audioOnly: true }, 'a')).toBe('playing');
    expect(trackAudio({ video: vid('a'), playing: false, audioOnly: true }, 'a')).toBe('paused');
  });
  it('otro track, nada sonando o el mismo video de fondo pero NO como After Day → sin el fondo', () => {
    expect(trackAudio({ video: vid('a'), playing: true, audioOnly: true }, 'b')).toBe('off');
    expect(trackAudio({ video: null, playing: false, audioOnly: true }, 'a')).toBe('off');
    expect(trackAudio({ video: vid('a'), playing: true, audioOnly: false }, 'a')).toBe('off');
  });
});

describe('trackTap y trackLabel', () => {
  it('tocar: arrancar / pausar / seguir', () => {
    expect(trackTap('off')).toBe('play');
    expect(trackTap('playing')).toBe('pause');
    expect(trackTap('paused')).toBe('resume');
  });
  it('el nombre accesible dice lo que hace tocarla; sin título, "audio"', () => {
    expect(trackLabel('off', 'Lluvia')).toBe('Escuchar Lluvia de fondo');
    expect(trackLabel('playing', 'Lluvia')).toBe('Pausar Lluvia');
    expect(trackLabel('paused', 'Lluvia')).toBe('Seguir escuchando Lluvia');
    expect(trackLabel('off')).toBe('Escuchar audio de fondo');
    expect(trackLabel('playing', '')).toBe('Pausar audio');
  });
});

describe('resumeAfterWatch («Ver» al cerrarse)', () => {
  const paused = (id: string) => ({ video: vid(id), playing: false });
  it('se miró el MISMO track que sonaba → no reanuda (queda en pausa)', () => {
    expect(resumeAfterWatch('a', 'a', paused('a'))).toBe(false);
  });
  it('sonaba OTRO → reanuda ese', () => {
    expect(resumeAfterWatch('b', 'a', paused('b'))).toBe(true);
  });
  it('si el visor no pausó nada, no reanuda nada', () => {
    expect(resumeAfterWatch(null, 'a', paused('b'))).toBe(false);
  });
  it('si mientras tanto el fondo cambió, se apagó o ya suena, no lo pisa', () => {
    expect(resumeAfterWatch('b', 'a', paused('c'))).toBe(false);
    expect(resumeAfterWatch('b', 'a', { video: null, playing: false })).toBe(false);
    expect(resumeAfterWatch('b', 'a', { video: vid('b'), playing: true })).toBe(false);
  });
});
