import { useState } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "../../assets/icons"
import type { HeadingIssue, SEOHeading } from "../../types/seo"
import "./HeadingTree.css"

interface HeadingNode extends SEOHeading {
    children: HeadingNode[]
}

function buildHeadingTree(headings: SEOHeading[]): HeadingNode[] {
    const roots: HeadingNode[] = []
    const stack: HeadingNode[] = []

    headings.forEach(h => {
        const levelNum = Number(h.level[1])
        const node: HeadingNode = { ...h, children: [] }

        // Pop until we find a parent of lower level
        let top = stack.at(-1)
        while (top && Number(top.level[1]) >= levelNum) {
            stack.pop()
            top = stack.at(-1)
        }

        if (top) {
            top.children.push(node)
        } else {
            roots.push(node)
        }
        stack.push(node)
    })

    return roots
}

interface HeadingRowProps {
    node: HeadingNode
    depth?: number
    highlightedIndex?: number
}

function HeadingRow({ node, depth = 0, highlightedIndex }: HeadingRowProps) {
    const [isOpen, setIsOpen] = useState(true)
    const hasChildren = node.children.length > 0
    const isHighlighted = node.index === highlightedIndex
    const hasIssue = node.hasIssue ?? false

    return (
        <div
            className={`heading-tree-item ${hasIssue ? "has-issue" : ""} ${isHighlighted ? "highlighted" : ""}`}
            style={{ marginLeft: depth * 20 }}
            data-heading-index={node.index}
        >
            <div className="heading-tree-row">
                {hasChildren ? (
                    <button
                        className="heading-tree-toggle"
                        onClick={() => {
                            setIsOpen(!isOpen)
                        }}
                        aria-label={isOpen ? "Collapse section" : "Expand section"}
                    >
                        {isOpen ? <ChevronDownIcon /> : <ChevronUpIcon />}
                    </button>
                ) : (
                    <span className="heading-tree-indent" />
                )}

                <div className="heading-tree-content">
                    <span className={`heading-level-badge ${hasIssue ? "has-issue" : ""}`}>
                        {node.level.toUpperCase()}
                    </span>
                    <span className="heading-text">{node.text}</span>
                    {hasIssue && <span className="issue-indicator">⚠️</span>}
                    {!node.visible && <span className="heading-meta">(hidden)</span>}
                </div>
            </div>

            {hasChildren && isOpen && (
                <div className="heading-tree-children">
                    {node.children.map((child, index) => (
                        <HeadingRow
                            key={child.index || index}
                            node={child}
                            depth={depth + 1}
                            highlightedIndex={highlightedIndex}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

interface HeadingTreeProps {
    headings: SEOHeading[]
    issues?: HeadingIssue[]
    highlightedIndex?: number
}

export function HeadingTree({ headings, issues = [], highlightedIndex }: HeadingTreeProps) {
    // Mark headings with issues
    const headingsWithIssues = headings.map(heading => ({
        ...heading,
        hasIssue: issues.some(issue => issue.index === heading.index),
        issueType: issues.find(issue => issue.index === heading.index)?.type,
    }))

    const tree = buildHeadingTree(headingsWithIssues)

    return (
        <div className="heading-tree">
            {tree.map((node, index) => (
                <HeadingRow key={node.index || index} node={node} highlightedIndex={highlightedIndex} />
            ))}
        </div>
    )
}
