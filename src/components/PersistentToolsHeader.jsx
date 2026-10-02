import React, { useState } from 'react';
import { CalendarDays, Calculator as CalculatorIcon, Home } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { useLocation, useNavigate } from 'react-router-dom';

import DateTimeDisplay from '@/components/DateTimeDisplay';
import HP12cCalculator from '@/components/HP12cCalculator';
import StandardCalculator from '@/components/StandardCalculator';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PersistentToolsHeader = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const showQuickTools = pathname !== '/login';

  return (
    <header
      className="relative z-40 mb-6 flex w-full flex-row flex-nowrap items-center justify-start gap-3 overflow-x-auto px-1 pb-1 sm:justify-center xl:absolute xl:left-1/2 xl:top-0 xl:mb-0 xl:w-auto xl:-translate-x-1/2 xl:overflow-visible xl:px-0 xl:pb-0 xl:pt-10 [&>*]:shrink-0"
      aria-label="Ferramentas rápidas"
    >
      <DateTimeDisplay className="whitespace-nowrap text-base font-medium text-white/80" />

      {showQuickTools && (
        <Button variant="outline" className="flex items-center gap-2" onClick={() => navigate('/')}>
          <Home className="h-4 w-4" />
          Home
        </Button>
      )}

      {showQuickTools && <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-auto border-white/20 bg-[#142961] p-0 text-white shadow-2xl"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            defaultMonth={selectedDate}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>}

      {showQuickTools && <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <CalculatorIcon className="h-4 w-4" />
            Calculadora
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-auto border-white/20 bg-[#142961] p-0 text-white shadow-2xl"
        >
          <StandardCalculator />
        </PopoverContent>
      </Popover>}

      {showQuickTools && <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <CalculatorIcon className="h-4 w-4" />
            HP 12c
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="max-h-[85vh] w-auto overflow-y-auto border-white/20 bg-[#171a20] p-0 text-white shadow-2xl"
        >
          <HP12cCalculator />
        </PopoverContent>
      </Popover>}
    </header>
  );
};

export default PersistentToolsHeader;
