"use main";
'use client';

import React, { useState, useEffect } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';

// Types for our component state
type BoardRepresentation = ({ type: PieceSymbol; color: Color; square: Square } | null)[][];

export default function WizardChess() {
  const [game, setGame] = useState<Chess | null>(null);
  const [board, setBoard] = useState<BoardRepresentation>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>('White to move');

  // Initialize game engine on mount to prevent SSR mismatches
  useEffect(() => {
    const chessInstance = new Chess();
    setGame(chessInstance);
    setBoard(chessInstance.board());
  }, []);

  if (!game) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">Loading Chamber...</div>;

  const handleSquareClick = (squareRepresentation: Square) => {
    const piece = game.get(squareRepresentation);
    const isCurrentPlayerPiece = piece && piece.color === game.turn();

    // Phase 1: Selecting a piece to move
    if (isCurrentPlayerPiece) {
      setSelectedSquare(squareRepresentation);
      // Fetch valid destination squares for the highlighted piece
      const moves = game.moves({ square: squareRepresentation, verbose: true });
      setPossibleMoves(moves.map((m) => m.to));
      return;
    }

    // Phase 2: Attempting a move to a destination square
    if (selectedSquare) {
      const moveAttempt = {
        from: selectedSquare,
        to: squareRepresentation,
        promotion: 'q', // Automatically promote to Queen for simplicity
      };

      try {
        // Inspect if the move is a capture before executing for combat logic
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const targetMove = moves.find((m) => m.to === squareRepresentation);
        const isCapture = targetMove && targetMove.captured;

        const move = game.move(moveAttempt);

        if (move) {
          // Execution Phase
          if (isCapture) {
            // Future placeholder: triggerShatterAnimation(squareRepresentation)
            console.log(`Wizarding Combat: Piece smashed on ${squareRepresentation}`);
          }

          // Sync underlying engine state to UI state
          setBoard(game.board());
          setSelectedSquare(null);
          setPossibleMoves([]);
          updateGameStatus();
        }
      } catch (error) {
        // Handle illegal selection attempts gracefully
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  };

  const updateGameStatus = () => {
    if (game.isCheckmate()) {
      setGameStatus(`Checkmate! Game Over.`);
    } else if (game.isDraw()) {
      setGameStatus('Stalemate! The match is a draw.');
    } else if (game.inCheck()) {
      setGameStatus(`Check! ${game.turn() === 'w' ? 'White' : 'Black'} is under attack.`);
    } else {
      setGameStatus(`${game.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  };

  const getUnicodePiece = (type: PieceSymbol, color: Color) => {
    const pieces: Record<PieceSymbol, { w: string; b: string }> = {
      p: { w: '♙', b: '♟' },
      r: { w: '♖', b: '♜' },
      n: { w: '♘', b: '♞' },
      b: { w: '♗', b: '♝' },
      q: { w: '♕', b: '♛' },
      k: { w: '♔', b: '♚' },
    };
    return pieces[type][color];
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 selection:bg-amber-900/50">
      <div className="max-w-2xl w-full flex flex-col items-center gap-6">
        
        {/* Header Branding */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-widest text-neutral-200 uppercase">Wizarding Chess</h1>
          <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent mx-auto" />
          <p className="text-sm font-mono tracking-wider text-amber-600/80">{gameStatus}</p>
        </header>

        {/* Chessboard Grid */}
        <div className="border border-neutral-800/80 p-3 bg-neutral-900/40 rounded shadow-2xl backdrop-blur-sm">
          <div className="grid grid-cols-8 border border-neutral-900">
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => {
                // Generate traditional algebraic coordinates (e.g., a8, h1)
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
                      w-14 h-14 sm:w-18 sm:h-18 flex items-center justify-center text-3xl sm:text-4xl 
                      transition-all duration-200 relative outline-none font-light
                      ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-900'}
                      ${isSelected ? 'ring-2 ring-amber-600 ring-inset z-10' : ''}
                    `}
                  >
                    {/* Visual target marker for legal moves */}
                    {isHighlightedDestination && (
                      <span className="absolute w-3.5 h-3.5 rounded-full bg-amber-600/50 pointer-events-none" />
                    )}
                    
                    {/* Render piece token if exists */}
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

        {/* Footer controls */}
        <footer className="w-full flex justify-between px-2 text-xs font-mono text-neutral-500">
          <span>Ruleset: Standard Classic</span>
          <span>Engine: Active</span>
        </footer>
      </div>
    </main>
  );
}