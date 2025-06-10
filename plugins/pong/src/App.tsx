import { useEffect, useRef, useState } from "react"
import { type CanvasNode, framer, useIsAllowedTo } from "framer-plugin"
import { Vector2 } from "./vector2"
import { Rect2 } from "./rect2"
import { randomRange } from "./randomRange"

import "./App.css"

interface Entity {
    id: string
    type: "ball" | "paddle"
    rect: Rect2
    velocity: Vector2
}

interface GameState {
    entities: Entity[]
}

const FPS = 60

void framer.showUI({
    position: "top right",
    width: 240,
    height: 110,
})

export function App() {
    const isAllowedToSetAttributes = useIsAllowedTo("setAttributes")

    const [isGameRunning, setIsGameRunning] = useState(false)
    const [selection, setSelection] = useState<CanvasNode[]>([])
    const gameState = useRef<GameState | null>()

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    useEffect(() => {
        let frame: number = -1
        let lastUpdateTime: number = 0

        const stage: Rect2 = new Rect2(0, 0, 1200, 1000)

        const update = () => {
            if (isGameRunning && Date.now() - lastUpdateTime > 1000 / FPS) {
                const entities = gameState.current?.entities ?? []

                // Read in paddle positions from the canvas.
                for (const entity of entities) {
                    if (entity.type === "paddle") {
                        framer.getRect(entity.id).then(rect => {
                            if (!rect) return
                            entity.rect = new Rect2(rect.x, rect.y, rect.width, rect.height)
                        })
                    }
                }

                // Simulate balls colliding with other things and walls.
                for (const entity of entities) {
                    if (entity.type === "ball") {
                        entity.rect.position = entity.rect.position.add(entity.velocity)

                        for (const otherEntity of entities) {
                            // Don't collide with self.
                            if (entity.id === otherEntity.id) continue

                            const intersection: Rect2 | null = entity.rect.intersection(otherEntity.rect)

                            if (intersection) {
                                const otherEntityCenter: Vector2 = otherEntity.rect.position.add(
                                    otherEntity.rect.size.scale(0.5)
                                )
                                const entityCenter: Vector2 = entity.rect.position.add(entity.rect.size.scale(0.5))
                                const bounceDirection: Vector2 = entityCenter.sub(otherEntityCenter).normalize()

                                entity.velocity = bounceDirection.scale(entity.velocity.magnitude())
                            }
                        }

                        if (
                            entity.rect.position.x < stage.position.x ||
                            entity.rect.position.x + entity.rect.size.x > stage.size.x
                        ) {
                            entity.velocity = entity.velocity.flipX()
                        }

                        if (
                            entity.rect.position.y < stage.position.y ||
                            entity.rect.position.y + entity.rect.size.y > stage.size.y
                        ) {
                            entity.velocity = entity.velocity.flipY()
                        }
                    }
                }

                // Update ball positions on the canvas.
                for (const entity of entities) {
                    if (entity.type === "ball") {
                        framer.setAttributes(entity.id, {
                            left: `${entity.rect.position.x}px`,
                            top: `${entity.rect.position.y}px`,
                            right: null,
                            bottom: null,
                        })
                    }
                }

                lastUpdateTime = Date.now()
            }

            frame = window.requestAnimationFrame(update)
        }

        update()

        return () => {
            window.cancelAnimationFrame(frame)
        }
    }, [isGameRunning])

    const setupFromSelection = async () => {
        if (!gameState.current) {
            gameState.current = { entities: [] }
        }

        gameState.current.entities = []

        for await (const node of selection) {
            const rect = await node.getRect()
            if (!rect) continue

            const isSquare = rect.width === rect.height

            gameState.current.entities.push({
                id: node.id,
                type: isSquare ? "ball" : "paddle",
                rect: new Rect2(rect.x, rect.y, rect.width, rect.height),
                velocity: new Vector2(randomRange(-1, 1), randomRange(-1, 1)).normalize().scale(10),
            })
        }

        setIsGameRunning(true)
    }

    return (
        <main>
            <p>
                Start by creating a Frame containing at least one circular Frame and two rectangles, then starting the
                game.
            </p>
            {isGameRunning ? (
                <button className="framer-button-primary" onClick={() => setIsGameRunning(false)}>
                    Stop Game
                </button>
            ) : (
                <button
                    className="framer-button-primary"
                    onClick={() => {
                        if (!isAllowedToSetAttributes) return
                        setupFromSelection()
                    }}
                    disabled={!isAllowedToSetAttributes}
                    title={isAllowedToSetAttributes ? undefined : "Insufficient permissions"}
                >
                    Start Game
                </button>
            )}
        </main>
    )
}
