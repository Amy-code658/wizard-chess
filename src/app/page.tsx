'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';

type BoardRepresentation = ({ type: PieceSymbol; color: Color; square: Square } | null)[][];

export default function WizardChess() {
  const [game, setGame] = useState<Chess | null>(null);
  const [board, setBoard] = useState<BoardRepresentation>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>('White to move');
  
  // Voice Recognition States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const chessInstance = new Chess();
    setGame(chessInstance);
    setBoard(chessInstance.board());

    // Initialize Web Speech API
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
        console.error('Speech error', event);
        setVoiceError(`Spell failed: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const command = event.results[0][0].transcript;
        setTranscript(`"${command}"`);
        handleVoiceCommand(command, chessInstance);
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceError('Your browser browser does not support voice spells.');
    }
  }, []);

  if (!game) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">Loading Chamber...</div>;

  // The Magic Spell Parser
  const handleVoiceCommand = (rawText: string, currentGame: Chess) => {
    const cleanText = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    // 1. Locate the destination square coordinate (e.g., e4, f3)
    const squareRegex = /[a-h][1-8]/;
    const match = cleanText.match(squareRegex);
    
    if (!match) {
      setVoiceError('Could not resolve destination square coordinates.');
      return;
    }
    const targetSquare = match[0];

    // 2. Map piece spoken vocabulary to shorthand notation character prefixes
    let piecePrefix = '';
    if (cleanText.includes('knight') || cleanText.includes('night')) piecePrefix = 'N';
    else if (cleanText.includes('bishop')) piecePrefix = 'B';
    else if (cleanText.includes('rook') || cleanText.includes('look')) piecePrefix = 'R';
    else if (cleanText.includes('queen')) piecePrefix = 'Q';
    else if (cleanText.includes('king')) piecePrefix = 'K';

    // Construct standard algebraic notation token (e.g., Nf3, e4)
    const sanMove = `${piecePrefix}${targetSquare}`;

    try {
      const move = currentGame.move(sanMove);
      if (move) {
        // Handle physical state synchronization block 
        setBoard(currentGame.board());
        setSelectedSquare(null);
        setPossibleMoves([]);
        updateGameStatus(currentGame);
      }
    } catch (err) {
      // If direct notation parsing fails, try evaluating pieces that can reach the square
      attemptAdvancedFallbackParsing(piecePrefix || 'p', targetSquare as Square, currentGame);
    }
  };

  // Fallback parsing handles ambiguous context (e.g., "Pawn to E4" when engine expects just "e4")
  const attemptAdvancedFallbackParsing = (pieceType: string, toSquare: Square, currentGame: Chess) => {
    const validMoves = currentGame.moves({ verbose: true });
    const matchingMove = validMoves.find(
      (m) => m.piece === pieceType && m.to === toSquare && m.color === currentGame.turn()
    );

    if (matchingMove) {
      currentGame.move({ from: matchingMove.from, to: matchingMove.to });
      setBoard(currentGame.board());
      setSelectedSquare(null);
      setPossibleMoves([]);
      updateGameStatus(currentGame);
    } else {
      setVoiceError(`Illegal move sequence attempted.`);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
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
        if (move) {
          setBoard(game.board());
          setSelectedSquare(null);
          setPossibleMoves([]);
          updateGameStatus(game);
        }
      } catch (error) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
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
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 selection:bg-amber-900/50">
      <div className="max-w-2xl w-full flex flex-col items-center gap-6">
        
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-widest text-neutral-200 uppercase">Wizarding Chess</h1>
          <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent mx-auto" />
          <p className="text-sm font-mono tracking-wider text-amber-600/80">{gameStatus}</p>
        </header>

        {/* Voice Control Hub panel */}
        <div className="w-full max-w-md bg-neutral-900/30 border border-neutral-800/60 rounded p-4 flex flex-col items-center gap-3 text-center">
          <button
            onClick={toggleListening}
            className={`px-5 py-2 rounded-full font-mono text-xs tracking-widest uppercase transition-all duration-300 border
              ${isListening 
                ? 'bg-red-950/40 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse' 
                : 'bg-neutral-900 border-amber-700/40 text-amber-600 hover:border-amber-600'
              }`}
          >
            {isListening ? '⚡ Casting Spell... ⚡' : '🎙️ Speak Command'}
          </button>
          
          {transcript && <p className="text-sm italic text-neutral-400 font-serif">{transcript}</p>}
          {voiceError && <p className="text-xs font-mono text-red-500/90">{voiceError}</p>}
          <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Try: "Knight to C3" or "E4"</p>
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

                return (
                  <button
                    key={squareCoord}
                    onClick={() => handleSquareClick(squareCoord)}
                    className={`
                      w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center text-3xl sm:text-4xl 
                      transition-all duration-200 relative outline-none font-light
                      ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-900'}
                      ${isSelected ? 'ring-2 ring-amber-600 ring-inset z-10' : ''}
                    `}
                  >
                    {isHighlightedDestination && (
                      <span className="absolute w-3 h-3 rounded-full bg-amber-600/50 pointer-events-none" />
                    )}
                    {piece && (
                      <span className="transform select-none transition-transform active:scale-95">
                        {getUnicodePiece(piece.type, piece.color)}
                      </span>
                    )}
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