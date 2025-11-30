
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CELL_SIZE, ALL_SHAPES } from '../../constants/puzzleGrid';
import { QuadrantType, Position } from '../../types';
import { useGameStore } from '../../store/puzzleSessionStore';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';

interface QuadrantSpawnerProps {
    quadrant: QuadrantType;
    label: string;
    color: string;
    className?: string;
    // shapePreset is optional now, if not provided we pick random
    shapePreset?: Position[];
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

export const QuadrantSpawner: React.FC<QuadrantSpawnerProps> = ({ quadrant, label, color, className, shapePreset }) => {
    const { addPiece, isValidDrop } = useGameStore();
    const [isDragging, setIsDragging] = useState(false);
    const [dragKey, setDragKey] = useState(0);
    const [isValid, setIsValid] = useState(true);

    const [currentLabel, setCurrentLabel] = useState(randomLabel(quadrant));
    // Store the current shape in state so it persists during drag. Randomize on mount and on drop.
    const [currentShape, setCurrentShape] = useState(shapePreset || getRandomShape());

    const buttonRef = useRef<HTMLDivElement>(null);
    const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);
    const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number, y: number } | null>(null);
    const dragYHistory = useRef<{ y: number, time: number }[]>([]);
    const lastShakeTime = useRef(0);
    const [isShaking, setIsShaking] = useState(false);

    const handleDragStart = (event: any, info: any) => {
        setIsDragging(true);
        setIsShaking(false);
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDragStartPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
    };

    const handleDrag = (_: any, info: any) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const rawX = info.point.x - centerX;
        const rawY = info.point.y - centerY;
        const gridX = Math.floor(rawX / CELL_SIZE + 0.5);
        const gridY = Math.floor(rawY / CELL_SIZE + 0.5);

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

        const gridX = Math.floor(rawX / CELL_SIZE + 0.5);
        const gridY = Math.floor(rawY / CELL_SIZE + 0.5);

        const valid = isValidDrop({ x: gridX, y: gridY }, currentShape);

        if (valid) {
            addPiece({
                id: uuidv4(),
                quadrant,
                color,
                position: { x: gridX, y: gridY },
                cells: currentShape,
                label: currentLabel
            });
            setDragKey(k => k + 1);
            setCurrentLabel(randomLabel(quadrant));
            // Pick new shape for next time
            if (!shapePreset) {
                setCurrentShape(getRandomShape());
            }
        }
    };

    return (
        <>
            {isDragging && dragStartPos && dragCurrentPos && (
                <div className="fixed inset-0 pointer-events-none z-40">
                    <svg className="w-full h-full overflow-visible">
                        <line
                            x1={dragStartPos.x}
                            y1={dragStartPos.y}
                            x2={dragCurrentPos.x}
                            y2={dragCurrentPos.y}
                            stroke={color}
                            strokeWidth="3"
                            strokeDasharray="6 4"
                            strokeOpacity="0.6"
                        />
                        <circle cx={dragStartPos.x} cy={dragStartPos.y} r="4" fill={color} />
                    </svg>
                </div>
            )}

            <div className={`absolute ${className} flex items-center justify-center z-30`}>
                <div className="relative group" ref={buttonRef}>
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
                            <div className="relative">
                                <AnimatePresence mode='wait'>
                                    {currentShape.map((cell, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{
                                                opacity: 1,
                                                scale: isShaking ? 1.1 : 1,
                                                filter: isShaking ? 'brightness(1.2)' : 'brightness(1)'
                                            }}
                                            className={clsx(
                                                "absolute transition-colors duration-200 backdrop-blur-md",
                                                !isValid && "bg-red-500/80",
                                                isValid && "shadow-lg"
                                            )}
                                            style={{
                                                width: CELL_SIZE - 0.5,
                                                height: CELL_SIZE - 0.5,
                                                background: isValid
                                                    ? `linear-gradient(135deg, ${color}FF, ${color}CC)`
                                                    : undefined,
                                                left: cell.x * CELL_SIZE,
                                                top: cell.y * CELL_SIZE,
                                                borderRadius: '2px',
                                                border: '1px solid rgba(255,255,255,0.2)'
                                            }}
                                        >
                                            {isValid && <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />}
                                            {idx === 0 && isValid && (
                                                <motion.div
                                                    key={currentLabel}
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="absolute inset-0 flex items-center justify-center p-1 pointer-events-none"
                                                >
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-wider text-center drop-shadow-md leading-none">
                                                        {currentLabel}
                                                    </span>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </>
    );
};
