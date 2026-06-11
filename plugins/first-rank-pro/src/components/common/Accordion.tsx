import React, { useState } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "../../assets/icons"
import "./Accordion.css"

interface AccordionProps {
    title: string
    icon?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export function Accordion({ title, icon, children, className = "" }: AccordionProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className={`accordion ${className}`}>
            <button
                className="accordion-header"
                onClick={() => {
                    setIsOpen(!isOpen)
                }}
                aria-expanded={isOpen}
            >
                <div className="accordion-header-content">
                    {icon && <span className="accordion-icon">{icon}</span>}
                    <span>{title}</span>
                </div>
                {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>

            <div className={`accordion-content ${isOpen ? "open" : ""}`}>{children}</div>
        </div>
    )
}
