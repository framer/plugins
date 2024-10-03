import React from "react"
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"

interface MenuItemType {
    label: string
    onClick: () => void
    icon?: React.ReactNode
}

interface DropdownMenuProps {
    menuItems: MenuItemType[]
    children: (props: { isOpen: boolean }) => React.ReactNode
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children, menuItems }) => {
    return (
        <Menu>
            {({ open }) => (
                <>
                    <MenuButton as="div">{children({ isOpen: open })}</MenuButton>
                    <MenuItems
                        anchor={{
                            to: "bottom end",
                            padding: "44px",
                        }}
                        className="absolute top-full mt-1 right-0 bg-white dark:bg-tertiary w-[80px] rounded-[10px] z-10 p-[5px] outline-none menu-shadow"
                    >
                        {menuItems.map((item, index) => (
                            <MenuItem key={index}>
                                {({ close }) => (
                                    <button
                                        className="w-full h-[30px] rounded-[5px] cursor-default flex items-center px-2.5 outline-none bg-white dark:bg-tertiary dark:data-[focus]:bg-tint data-[focus]:bg-tint data-[focus]:text-white transition-none"
                                        onClick={() => {
                                            item.onClick()
                                            close()
                                        }}
                                    >
                                        {item.icon && <span className="mr-2">{item.icon}</span>}
                                        <span className="font-normal leading-[1.2em] text-xs text-left">
                                            {item.label}
                                        </span>
                                    </button>
                                )}
                            </MenuItem>
                        ))}
                    </MenuItems>
                </>
            )}
        </Menu>
    )
}
