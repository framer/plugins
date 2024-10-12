import { useSelect, UseSelectSelectedItemChange } from 'downshift';

export interface SelectOption {
  id: number | string;
  title: string;
}

interface SelectProps {
  selected: SelectOption;
  options: SelectOption[];
  onChange: (changes: UseSelectSelectedItemChange<SelectOption>) => void;
}

function itemToString(item: SelectOption | null) {
  return item ? item.title : '';
}

export default function Select({
  selected: selectedItem,
  options,
  onChange,
}: SelectProps) {
  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    highlightedIndex,
    getItemProps,
  } = useSelect({
    items: options,
    itemToString,
    selectedItem,
    onSelectedItemChange: onChange,
  });

  return (
    <div
      className={[
        'select-container',
        isOpen ? 'select-container--open' : undefined,
      ].join(' ')}
    >
      <div className="w-72 flex flex-col gap-1">
        <div className="select-button" {...getToggleButtonProps()}>
          <span>{selectedItem ? selectedItem.title : 'Select a range'}</span>
          <span className="select-button--arrow">
            {isOpen ? <>&#8593;</> : <>&#8595;</>}
          </span>
        </div>
      </div>
      <ul
        // className={`absolute w-72 bg-white mt-1 shadow-md max-h-80 overflow-scroll p-0 z-10 ${
        //   !isOpen && 'hidden'
        // }`}
        className="select-options"
        {...getMenuProps()}
      >
        {isOpen &&
          options.map((item, index) => (
            <li
              className={[
                'select-option',
                highlightedIndex === index
                  ? 'select-option--highlighted'
                  : undefined,
                selectedItem.id === item.id
                  ? 'select-option--selected'
                  : undefined,
              ].join(' ')}
              key={item.id}
              {...getItemProps({ item, index })}
            >
              <span>{item.title}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
