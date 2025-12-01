
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CELL_SIZE, ALL_SHAPES } from '../../constants/puzzleGrid';
import { QuadrantType, Position, PieceCategoryType, PiecePriority } from '../../types';
import { useGameStore } from '../../store/puzzleSessionStore';
import { usePuzzleSessionStateStore } from '../../store/puzzleSessionStateStore';
import { eventBus, contextStore } from '../../store/runtime';
import { getPriorityColor } from '../../constants/colors';
import { DesignMode } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface QuadrantSpawnerProps {
    quadrant: QuadrantType;
    label: string;
    color: string;
    className?: string;
    shapePreset?: Position[];
    puzzleId?: string;
}

const randomLabel = (q: QuadrantType) => {
    const labels = {
        form: ['Solid', 'Light', 'Heavy', 'Soft', 'Round'],
        motion: ['Fast', 'Slow', 'Glide', 'Pop', 'Flow'],
        expression: ['Happy', 'Bold', 'Quiet', 'Zen', 'Loud'],
        function: ['Logo', 'Icon', 'Sign', 'Nav', 'Btn']
    };
    return labels[q][Math.floor(Math.random() * labels[q].length)];
};

const getRandomShape = () => {
    return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
};

/**
 * Get corner radius info for a cell based on neighboring cells
 */
const getCellCorners = (
    cell: Position,
    cellSet: Set<string>,
    radius: number
): { tl: number; tr: number; br: number; bl: number } => {
    const hasCell = (x: number, y: number) => cellSet.has(`${x},${y}`);
    const { x, y } = cell;

    return {
        tl: !hasCell(x, y - 1) && !hasCell(x - 1, y) ? radius : 0,
        tr: !hasCell(x, y - 1) && !hasCell(x + 1, y) ? radius : 0,
        br: !hasCell(x, y + 1) && !hasCell(x + 1, y) ? radius : 0,
        bl: !hasCell(x, y + 1) && !hasCell(x - 1, y) ? radius : 0,
    };
};

/**
 * Generate SVG path for a single cell with selective rounded corners
 */
const generateCellPath = (
    cell: Position,
    cellSet: Set<string>,
    cellSize: number,
    radius: number
): string => {
    const corners = getCellCorners(cell, cellSet, radius);
    const x = cell.x * cellSize;
    const y = cell.y * cellSize;
    const w = cellSize;
    const h = cellSize;
    const { tl, tr, br, bl } = corners;

    let d = `M ${x + tl} ${y}`;
    d += ` L ${x + w - tr} ${y}`;
    if (tr > 0) d += ` Q ${x + w} ${y} ${x + w} ${y + tr}`;
    d += ` L ${x + w} ${y + h - br}`;
    if (br > 0) d += ` Q ${x + w} ${y + h} ${x + w - br} ${y + h}`;
    d += ` L ${x + bl} ${y + h}`;
    if (bl > 0) d += ` Q ${x} ${y + h} ${x} ${y + h - bl}`;
    d += ` L ${x} ${y + tl}`;
    if (tl > 0) d += ` Q ${x} ${y} ${x + tl} ${y}`;
    d += ' Z';

    return d;
};

/**
 * Generate combined SVG path for all cells
 */
const generateShapePath = (cells: Position[], cellSize: number, cornerRadius: number = 14): string => {
    if (cells.length === 0) return '';

    const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
    const paths = cells.map(cell => generateCellPath(cell, cellSet, cellSize, cornerRadius));
    return paths.join(' ');
};

export const QuadrantSpawner: React.FC<QuadrantSpawnerProps> = ({ quadrant, label, color, className, shapePreset, puzzleId }) => {
    const { addPiece, isValidDrop, currentPuzzleId } = useGameStore();

    // Get pre-generated pieces from session state store
    const {
        getNextPiece,
        markPieceUsed,
        isGenerating,
        sessionState,
    } = usePuzzleSessionStateStore();

    const [isDragging, setIsDragging] = useState(false);
    const [dragKey, setDragKey] = useState(0);
    const [isValid, setIsValid] = useState(true);

    // Get pre-generated piece for this quadrant, or fallback to random label
    const preGeneratedPiece = useMemo(() => getNextPiece(quadrant), [quadrant, dragKey, sessionState]);
    const [currentLabel, setCurrentLabel] = useState(preGeneratedPiece?.text || randomLabel(quadrant));
    const [currentPriority, setCurrentPriority] = useState<PiecePriority>(preGeneratedPiece?.priority || 3);
    const [currentShape, setCurrentShape] = useState(shapePreset || getRandomShape());

    // Update label when pre-generated piece changes
    useEffect(() => {
        if (preGeneratedPiece) {
            setCurrentLabel(preGeneratedPiece.text);
            setCurrentPriority(preGeneratedPiece.priority);
        }
    }, [preGeneratedPiece]);

    const buttonRef = useRef<HTMLDivElement>(null);
    const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);
    const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number, y: number } | null>(null);
    const dragYHistory = useRef<{ y: number, time: number }[]>([]);
    const lastShakeTime = useRef(0);
    const [isShaking, setIsShaking] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<PieceCategoryType>('clarify');
    const [pendingPieceId, setPendingPieceId] = useState<string | null>(null);
    const [pendingContent, setPendingContent] = useState<{ title: string; content: string } | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    // Get priority-based color for this quadrant
    const priorityColor = useMemo(() => {
        const mode = quadrant.toUpperCase() as DesignMode;
        return getPriorityColor(mode, currentPriority);
    }, [quadrant, currentPriority]);

    // Listen for AI content updates
    useEffect(() => {
        if (!pendingPieceId) return;

        const handler = (event: any) => {
            if (event.type === 'PIECE_CONTENT_UPDATED' && event.payload?.pieceId === pendingPieceId) {
                setPendingContent({
                    title: event.payload.title || 'New Idea',
                    content: event.payload.content || '',
                });
                setIsLoadingContent(false);
            }
        };

        // subscribe returns an unsubscribe function
        const unsubscribe = eventBus.subscribe(handler);
        return unsubscribe;
    }, [pendingPieceId]);

    // Generate SVG path for current shape
    const shapePath = useMemo(() => generateShapePath(currentShape, CELL_SIZE, 14), [currentShape]);

    // Calculate bounds for the shape
    const shapeBounds = useMemo(() => {
        const minX = Math.min(...currentShape.map(c => c.x));
        const maxX = Math.max(...currentShape.map(c => c.x));
        const minY = Math.min(...currentShape.map(c => c.y));
        const maxY = Math.max(...currentShape.map(c => c.y));
        return {
            width: (maxX - minX + 1) * CELL_SIZE,
            height: (maxY - minY + 1) * CELL_SIZE,
            minX,
            minY,
            // Offset to convert cursor position (center of ghost) to shape origin
            // The ghost is dragged from its center, but grid position is the shape's origin
            offsetX: (minX + maxX + 1) / 2,  // center X in grid units
            offsetY: (minY + maxY + 1) / 2,  // center Y in grid units
        };
    }, [currentShape]);

    const getNextCategory = (): PieceCategoryType => {
        const categories: PieceCategoryType[] = ['clarify', 'expand', 'refine'];
        const currentIndex = categories.indexOf(currentCategory);
        const nextIndex = (currentIndex + 1) % categories.length;
        return categories[nextIndex];
    };

    const requestAIContent = useCallback((pieceId: string, position: { x: number; y: number }) => {
        const activePuzzleId = puzzleId || currentPuzzleId;
        if (!activePuzzleId) {
            console.warn('[QuadrantSpawner] No active puzzle for AI');
            return;
        }

        const state = contextStore.getState();
        const puzzle = state.puzzles.find(p => p.id === activePuzzleId);
        const anchors = state.anchors.filter(a => a.puzzleId === activePuzzleId);
        const existingPieces = state.puzzlePieces.filter(
            p => p.puzzleId === activePuzzleId && p.mode === quadrant.toUpperCase()
        );

        // Get puzzleType from the SESSION, not per-piece
        const puzzleType = puzzle?.type || 'CLARIFY';

        console.log(`[QuadrantSpawner] Auto-generating AI content for piece: ${pieceId}, puzzleType: ${puzzleType}`);

        eventBus.emitType('PIECE_CREATED', {
            mode: quadrant.toUpperCase(),
            puzzleType,  // Session-level puzzle type
            pieceId,
            position,
            puzzle: {
                id: activePuzzleId,
                centralQuestion: puzzle?.centralQuestion || 'What is the core question?',
                type: puzzleType,
            },
            anchors: anchors.map(a => ({ type: a.type, text: a.text })),
            existingPiecesForMode: existingPieces.map(p => ({
                text: p.text,
                userAnnotation: p.userAnnotation,
                status: p.status,
            })),
        });
    }, [puzzleId, currentPuzzleId, quadrant]);

    const handleDragStart = (event: any, info: any) => {
        setIsDragging(true);
        setIsShaking(false);
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDragStartPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }

        // Generate piece ID for tracking
        const newPieceId = uuidv4();
        setPendingPieceId(newPieceId);

        // If we have a pre-generated piece, use its content immediately
        if (preGeneratedPiece) {
            setPendingContent({
                title: preGeneratedPiece.text,
                content: '', // Pre-generated pieces are statements, no extended content
            });
            setIsLoadingContent(false);
        } else {
            // No pre-generated piece, will request AI content on drop
            setPendingContent(null);
            setIsLoadingContent(true);
        }
    };

    const handleDrag = (_: any, info: any) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const rawX = info.point.x - centerX;
        const rawY = info.point.y - centerY;
        // Adjust for shape offset: cursor is at ghost center, but grid pos is for shape origin
        const gridX = Math.floor(rawX / CELL_SIZE - shapeBounds.offsetX + 0.5);
        const gridY = Math.floor(rawY / CELL_SIZE - shapeBounds.offsetY + 0.5);

        setIsValid(isValidDrop({ x: gridX, y: gridY }, currentShape));
        setDragCurrentPos({ x: info.point.x, y: info.point.y });

        // Shake Logic
        const now = Date.now();
        const y = info.point.y;
        dragYHistory.current.push({ y, time: now });
        dragYHistory.current = dragYHistory.current.filter(p => now - p.time < 300);

        if (now - lastShakeTime.current > 500) {
            let reversals = 0;
            let direction = 0;
            for (let i = 1; i < dragYHistory.current.length; i++) {
                const dy = dragYHistory.current[i].y - dragYHistory.current[i - 1].y;
                if (Math.abs(dy) > 8) {
                    const newDir = dy > 0 ? 1 : -1;
                    if (direction !== 0 && newDir !== direction) {
                        reversals++;
                    }
                    direction = newDir;
                }
            }
            if (reversals >= 3) {
                const newLabel = randomLabel(quadrant);
                setCurrentLabel(l => newLabel === l ? randomLabel(quadrant) : newLabel);
                lastShakeTime.current = now;
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 300);
            }
        }
    };

    const handleDragEnd = (event: any, info: any) => {
        setIsDragging(false);
        setDragStartPos(null);
        setDragCurrentPos(null);
        dragYHistory.current = [];

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const rawX = info.point.x - centerX;
        const rawY = info.point.y - centerY;

        // Adjust for shape offset: cursor is at ghost center, but grid pos is for shape origin
        const gridX = Math.floor(rawX / CELL_SIZE - shapeBounds.offsetX + 0.5);
        const gridY = Math.floor(rawY / CELL_SIZE - shapeBounds.offsetY + 0.5);

        const valid = isValidDrop({ x: gridX, y: gridY }, currentShape);

        console.log('[QuadrantSpawner] Drop attempt:', {
            gridPos: { x: gridX, y: gridY },
            shape: currentShape,
            valid,
            pendingPieceId,
        });

        if (valid && pendingPieceId) {
            const category = currentCategory;

            // Use pre-generated piece content if available
            const hasPreGenerated = preGeneratedPiece && preGeneratedPiece.text;
            const title = hasPreGenerated ? preGeneratedPiece.text : (pendingContent?.title || '...');
            const content = pendingContent?.content || '';
            const pieceColor = hasPreGenerated ? priorityColor : color;
            const piecePriority = hasPreGenerated ? preGeneratedPiece.priority : 3;

            console.log(`[QuadrantSpawner] Creating piece with ${hasPreGenerated ? 'pre-generated' : 'fallback'} content: "${title}" (priority: ${piecePriority})`);

            // First add the piece to the store
            addPiece({
                id: pendingPieceId,
                quadrant,
                color: pieceColor,
                position: { x: gridX, y: gridY },
                cells: currentShape,
                text: title,
                title,
                content,
                category,
                source: 'ai',
                priority: piecePriority as PiecePriority,
            });

            // Mark pre-generated piece as used
            if (hasPreGenerated) {
                markPieceUsed(quadrant, preGeneratedPiece.text);
            } else {
                // Only request AI content if no pre-generated piece was available
                console.log(`[QuadrantSpawner] No pre-generated piece, requesting AI content for: ${pendingPieceId}`);
                requestAIContent(pendingPieceId, { x: gridX, y: gridY });
            }

            setCurrentCategory(getNextCategory());
            setDragKey(k => k + 1);

            // Get next pre-generated piece or use random label
            const nextPiece = getNextPiece(quadrant);
            if (nextPiece) {
                setCurrentLabel(nextPiece.text);
                setCurrentPriority(nextPiece.priority);
            } else {
                setCurrentLabel(randomLabel(quadrant));
                setCurrentPriority(3);
            }

            if (!shapePreset) {
                setCurrentShape(getRandomShape());
            }
        }

        // Clean up pending state
        setPendingPieceId(null);
        setPendingContent(null);
        setIsLoadingContent(false);
    };

    return (
        <>
            {/* Preview popup during drag */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed top-20 right-6 z-[100] pointer-events-none"
                        style={{ maxWidth: '320px' }}
                    >
                        <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
                            <div
                                className="px-4 py-2 border-b border-gray-700/50"
                                style={{ backgroundColor: priorityColor + '20' }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priorityColor }} />
                                    <span className="text-white font-semibold text-sm">
                                        {isLoadingContent ? 'Generating...' : (pendingContent?.title || currentLabel)}
                                    </span>
                                    <span className="text-xs text-gray-400 uppercase ml-auto">
                                        {quadrant} · P{currentPriority}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4">
                                {isLoadingContent ? (
                                    <div className="flex items-center gap-3">
                                        <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-white rounded-full" />
                                        <span className="text-gray-400 text-sm">AI is thinking...</span>
                                    </div>
                                ) : preGeneratedPiece ? (
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                        <span className="text-green-400 text-xs uppercase mr-2">Pre-generated</span>
                                        Drop to place this insight
                                    </p>
                                ) : pendingContent?.content ? (
                                    <p className="text-gray-300 text-sm leading-relaxed">{pendingContent.content}</p>
                                ) : (
                                    <p className="text-gray-500 text-sm italic">
                                        Drop near the center card to place this piece
                                    </p>
                                )}
                            </div>
                            {!isValid && (
                                <div className="px-4 py-2 bg-red-500/20 border-t border-red-500/30">
                                    <span className="text-red-400 text-xs">
                                        Invalid position - must connect to center or another piece
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Connection line during drag */}
            {isDragging && dragStartPos && dragCurrentPos && (
                <div className="fixed inset-0 pointer-events-none z-40">
                    <svg className="w-full h-full overflow-visible">
                        <line
                            x1={dragStartPos.x}
                            y1={dragStartPos.y}
                            x2={dragCurrentPos.x}
                            y2={dragCurrentPos.y}
                            stroke={priorityColor}
                            strokeWidth="3"
                            strokeDasharray="6 4"
                            strokeOpacity="0.6"
                        />
                        <circle cx={dragStartPos.x} cy={dragStartPos.y} r="4" fill={priorityColor} />
                    </svg>
                </div>
            )}

            <div className={`absolute ${className} flex items-center justify-center z-30`}>
                <div className="relative group" ref={buttonRef}>
                    {/* Main spawner button */}
                    <div
                        className="w-24 h-10 rounded-xl shadow-md flex items-center justify-center px-3 transition-all duration-200"
                        style={{
                            backgroundColor: color,
                            boxShadow: isDragging
                                ? '0 0 0 2px rgba(255,255,255,0.6), 0 10px 25px rgba(0,0,0,0.35)'
                                : '0 0 0 1px rgba(17,24,39,0.06), 0 8px 20px rgba(0,0,0,0.25)',
                            transform: isDragging ? 'translateY(2px) scale(0.98)' : 'translateY(0) scale(1)',
                        }}
                    >
                        <span className="text-[11px] font-bold tracking-wider text-white uppercase">
                            {label}
                        </span>
                    </div>

                    {/* Category indicator */}
                    <div
                        className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        title={`Next: ${currentCategory}`}
                    >
                        <span className="text-[8px] font-bold text-gray-500 uppercase">
                            {currentCategory.charAt(0)}
                        </span>
                    </div>

                    {/* Draggable area */}
                    <motion.div
                        key={dragKey}
                        drag
                        dragSnapToOrigin
                        whileDrag={{ scale: 1, opacity: 1, cursor: 'grabbing' }}
                        whileHover={{ scale: 1.05, cursor: 'grab' }}
                        onDragStart={handleDragStart}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                        className="absolute inset-0 z-50 flex items-center justify-center"
                    >
                        {!isDragging ? (
                            <div className="w-16 h-16 rounded-xl bg-transparent" />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{
                                    opacity: 1,
                                    scale: isShaking ? 1.1 : 1,
                                }}
                                className="relative"
                                style={{
                                    width: shapeBounds.width,
                                    height: shapeBounds.height,
                                }}
                            >
                                {/* Unified SVG shape */}
                                <svg
                                    width={shapeBounds.width}
                                    height={shapeBounds.height}
                                    className="absolute inset-0"
                                    style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))' }}
                                >
                                    <defs>
                                        <linearGradient id={`spawner-grad-${quadrant}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor={isValid ? priorityColor : '#ef4444'} stopOpacity="1" />
                                            <stop offset="100%" stopColor={isValid ? priorityColor : '#ef4444'} stopOpacity="0.85" />
                                        </linearGradient>
                                    </defs>
                                    {/* Fill without stroke to avoid internal lines */}
                                    <path
                                        d={shapePath}
                                        fill={`url(#spawner-grad-${quadrant})`}
                                        stroke="none"
                                    />
                                    {/* Outer border only */}
                                    <path
                                        d={shapePath}
                                        fill="none"
                                        stroke="rgba(255,255,255,0.4)"
                                        strokeWidth="1.5"
                                    />
                                </svg>

                                {/* Label overlay */}
                                {isValid && (
                                    <motion.div
                                        key={currentLabel}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                    >
                                        <span className="text-white font-bold text-[11px] uppercase tracking-wider text-center drop-shadow-lg">
                                            {currentLabel}
                                        </span>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </div>
        </>
    );
};
