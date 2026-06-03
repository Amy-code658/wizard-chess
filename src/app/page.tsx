'use main';
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';

type BoardRepresentation = ({ type: PieceSymbol; color: Color; square: Square } | null)[][];

interface Particle {
  id: number;
  tx: number;
  ty: number;
  rotate: number;
  size: number;
}

export default function WizardChess() {
  const [game, setGame] = useState<Chess | null>(null);
  const [board, setBoard] = useState<BoardRepresentation>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>('White to move');
  const [pieceIds, setPieceIds] = useState<Record<string, string>>({});

  // Combat Particle States
  const [shatterSquare, setShatterSquare] = useState<Square | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Voice States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  // Audio Reference Streams (Prevents SSR execution breaks)
  const moveAudioRef = useRef<HTMLAudioElement | null>(null);
  const captureAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const chessInstance = new Chess();
    setGame(chessInstance);
    setBoard(chessInstance.board());

    // Initialize Audio Channels securely on the Client side
    moveAudioRef.current = new Audio('/sounds/move.mp3');
    captureAudioRef.current = new Audio('/sounds/capture.mp3');
    
    // Optimize performance by pre-loading audio buffers over the pipeline
    moveAudioRef.current.load();
    captureAudioRef.current.load();

    const initialIds: Record<string, string> = {};
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    chessInstance.board().forEach((row, rowIndex) => {
      row.forEach((piece, colIndex) => {
        if (piece) {
          const square = `${files[colIndex]}${8 - rowIndex}`;
          initialIds[square] = `${piece.color}${piece.type}-${square}`;
        }
      });
    });
    setPieceIds(initialIds);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError('');
        setTranscript('Listening for command...');
      };
      recognition.onerror = (event: any) => {
        setVoiceError(`Spell failed: ${event.error}`);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const command = event.results[0][0].transcript;
        setTranscript(`"${command}"`);
        handleVoiceCommand(command, chessInstance);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  if (!game) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">Loading Chamber...</div>;

  // Plays specific audio clips cleanly, resetting overlapping tracks
  const playSoundEffect = (audioRef: React.RefObject<HTMLAudioElement | null>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Rewind track if rapidly fired
      audioRef.current.play().catch((err) => console.log('Audio playback context waiting for interaction.', err));
    }
  };

  const triggerShatterBlast = (targetSquare: Square) => {
    setShatterSquare(targetSquare);
    playSoundEffect(captureAudioRef); // Fire brutal smashing noise on impact

    const generatedParticles = Array.from({ length: 12 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 80;
      return {
        id: i,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        rotate: Math.random() * 360,
        size: 4 + Math.random() * 8,
      };
    });

    setParticles(generatedParticles);

    setTimeout(() => {
      setShatterSquare(null);
      setParticles([]);
    }, 600);
  };

  const handlePostMoveUpdates = (move: any) => {
    if (move.captured) {
      triggerShatterBlast(move.to);
    } else {
      playSoundEffect(moveAudioRef); // Fire stone-drag movement track
    }

    setPieceIds((prev) => {
      const next = { ...prev };
      const movingPieceId = next[move.from];
      
      delete next[move.from];
      next[move.to] = movingPieceId;

      if (move.flags.includes('k')) {
        const rFrom = move.color === 'w' ? 'h1' : 'h8';
        const rTo = move.color === 'w' ? 'f1' : 'f8';
        next[rTo] = next[rFrom];
        delete next[rFrom];
      } else if (move.flags.includes('q')) {
        const rFrom = move.color === 'w' ? 'a1' : 'a8';
        const rTo = move.color === 'w' ? 'd1' : 'd8';
        next[rTo] = next[rFrom];
        delete next[rFrom];
      }
      
      if (move.flags.includes('e')) {
        const epSquare = `${move.to[0]}${move.from[1]}`;
        delete next[epSquare];
      }
      return next;
    });

    setBoard(game.board());
    setSelectedSquare(null);
    setPossibleMoves([]);
    updateGameStatus(game);
  };

  const handleSquareClick = (squareRepresentation: Square) => {
    const piece = game.get(squareRepresentation);
    const isCurrentPlayerPiece = piece && piece.color === game.turn();

    if (isCurrentPlayerPiece) {
      setSelectedSquare(squareRepresentation);
      const moves = game.moves({ square: squareRepresentation, verbose: true });
      setPossibleMoves(moves.map((m) => m.to));
      return;
    }

    if (selectedSquare) {
      try {
        const move = game.move({ from: selectedSquare, to: squareRepresentation, promotion: 'q' });
        if (move) handlePostMoveUpdates(move);
      } catch (error) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  };

  const handleVoiceCommand = (rawText: string, currentGame: Chess) => {
    const cleanText = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const squareRegex = /[a-h][1-8]/;
    const match = cleanText.match(squareRegex);
    
    if (!match) {
      setVoiceError('Could not resolve destination square coordinates.');
      return;
    }
    const targetSquare = match[0];

    let piecePrefix = '';
    if (cleanText.includes('knight') || cleanText.includes('night')) piecePrefix = 'N';
    else if (cleanText.includes('bishop')) piecePrefix = 'B';
    else if (cleanText.includes('rook') || cleanText.includes('look')) piecePrefix = 'R';
    else if (cleanText.includes('queen')) piecePrefix = 'Q';
    else if (cleanText.includes('king')) piecePrefix = 'K';

    const sanMove = `${piecePrefix}${targetSquare}`;

    try {
      const move = currentGame.move(sanMove);
      if (move) handlePostMoveUpdates(move);
    } catch (err) {
      const validMoves = currentGame.moves({ verbose: true });
      const matchingMove = validMoves.find(
        (m) => m.piece === (piecePrefix || 'p').toLowerCase() && m.to === targetSquare && m.color === currentGame.turn()
      );

      if (matchingMove) {
        const move = currentGame.move({ from: matchingMove.from, to: matchingMove.to });
        if (move) handlePostMoveUpdates(move);
      } else {
        setVoiceError(`Illegal move sequence attempted.`);
      }
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  const updateGameStatus = (currentGame: Chess) => {
    if (currentGame.isCheckmate()) setGameStatus('Checkmate! Game Over.');
    else if (currentGame.isDraw()) setGameStatus('Match ended in a Draw.');
    else if (currentGame.inCheck()) setGameStatus(`Check! ${currentGame.turn() === 'w' ? 'White' : 'Black'} is threatened.`);
    else setGameStatus(`${currentGame.turn() === 'w' ? 'White' : 'Black'} to move`);
  };

  const getUnicodePiece = (type: PieceSymbol, color: Color) => {
    const pieces: Record<PieceSymbol, { w: string; b: string }> = {
      p: { w: '♙', b: '♟' }, r: { w: '♖', b: '♜' }, n: { w: '♘', b: '♞' },
      b: { w: '♗', b: '♝' }, q: { w: '♕', b: '♛' }, k: { w: '♔', b: '♚' },
    };
    return pieces[type][color];
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full flex flex-col items-center gap-6">
        
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-widest text-neutral-200 uppercase">Wizarding Chess</h1>
          <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent mx-auto" />
          <p className="text-sm font-mono tracking-wider text-amber-600/80">{gameStatus}</p>
        </header>

        {/* Voice Control Hub */}
        <div className="w-full max-w-md bg-neutral-900/30 border border-neutral-800/60 rounded p-4 flex flex-col items-center gap-3 text-center">
          <button
            onClick={toggleListening}
            className={`px-5 py-2 rounded-full font-mono text-xs tracking-widest uppercase transition-all duration-300 border
              ${isListening 
                ? 'bg-red-950/40 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : 'bg-neutral-900 border-amber-700/40 text-amber-600 hover:border-amber-600'
              }`}
          >
            {isListening ? '⚡ Casting Spell... ⚡' : '🎙️ Speak Command'}
          </button>
          {transcript && <p className="text-sm italic text-neutral-400 font-serif">{transcript}</p>}
          {voiceError && <p className="text-xs font-mono text-red-500/90">{voiceError}</p>}
        </div>

        {/* Board Container */}
        <div className="border border-neutral-800/80 p-3 bg-neutral-900/40 rounded shadow-2xl backdrop-blur-sm">
          <div className="grid grid-cols-8 border border-neutral-900">
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => {
                const file = String.fromCharCode(97 + colIndex);
                const rank = 8 - rowIndex;
                const squareCoord = `${file}${rank}` as Square;

                const isDark = (rowIndex + colIndex) % 2 === 1;
                const isSelected = selectedSquare === squareCoord;
                const isHighlightedDestination = possibleMoves.includes(squareCoord);
                const activePieceId = pieceIds[squareCoord];
                const isExploding = shatterSquare === squareCoord;

                return (
                  <button
                    key={squareCoord}
                    onClick={() => handleSquareClick(squareCoord)}
                    className={`
                      w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center text-3xl sm:text-4xl 
                      transition-colors duration-200 relative outline-none font-light
                      ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-900'}
                      ${isSelected ? 'ring-2 ring-amber-600 ring-inset z-10' : ''}
                    `}
                  >
                    {isHighlightedDestination && (
                      <span className="absolute w-3 h-3 rounded-full bg-amber-600/50 pointer-events-none z-20" />
                    )}
                    
                    {piece && activePieceId && (
                      <motion.span
                        layoutId={activePieceId}
                        transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                        className="transform select-none block z-10 pointer-events-none"
                      >
                        {getUnicodePiece(piece.type, piece.color)}
                      </motion.span>
                    )}

                    <AnimatePresence>
                      {isExploding && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                          {particles.map((particle) => (
                            <motion.div
                              key={particle.id}
                              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                              animate={{
                                x: particle.tx,
                                y: particle.ty,
                                opacity: 0,
                                scale: 0.2,
                                rotate: particle.rotate,
                              }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.55, ease: 'easeOut' }}
                              className="absolute bg-neutral-500 rounded-sm"
                              style={{
                                width: particle.size,
                                height: particle.size,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}