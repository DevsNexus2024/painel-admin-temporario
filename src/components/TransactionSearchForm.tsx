import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getStartOfDayTimestamp, getEndOfDayTimestamp } from "@/utils/date";

const formSchema = z.object({
    accountNumber: z.string().min(1, "Número da conta é obrigatório"),
    startDate: z.date({
        required_error: "Data inicial é obrigatória",
    }),
    endDate: z.date({
        required_error: "Data final é obrigatória",
    }),
});

type FormValues = z.infer<typeof formSchema>;

interface TransactionSearchFormProps {
    onSearch: (values: {
        accountNumber: string;
        startDate: number;
        endDate: number;
    }) => void;
    isLoading: boolean;
}

export function TransactionSearchForm({ onSearch, isLoading }: TransactionSearchFormProps) {
    const [dateOpen, setDateOpen] = useState<{ start: boolean; end: boolean }>({
        start: false,
        end: false,
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            accountNumber: "8734873",
            startDate: new Date(),
            endDate: new Date(),
        },
    });

    const onSubmit = (data: FormValues) => {
        onSearch({
            accountNumber: data.accountNumber,
            startDate: getStartOfDayTimestamp(data.startDate),
            endDate: getEndOfDayTimestamp(data.endDate),
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col w-full">
                        <FormField
                            control={form.control}
                            name="accountNumber"
                            render={({ field }) => (
                                <FormItem className="flex flex-col h-full">
                                    <FormLabel>Número da Conta</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Digite o número da conta" {...field} className="w-full" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex flex-col w-full">
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col h-full">
                                    <FormLabel>Data Inicial</FormLabel>
                                    <Popover open={dateOpen.start} onOpenChange={(open) => setDateOpen({ ...dateOpen, start: open })}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal w-full",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                                    ) : (
                                                        <span>Selecione uma data</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(date) => {
                                                    field.onChange(date);
                                                    setDateOpen({ ...dateOpen, start: false });
                                                }}
                                                disabled={(date) => date > new Date()}
                                                locale={ptBR}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex flex-col w-full">
                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col h-full">
                                    <FormLabel>Data Final</FormLabel>
                                    <Popover open={dateOpen.end} onOpenChange={(open) => setDateOpen({ ...dateOpen, end: open })}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal w-full",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                                    ) : (
                                                        <span>Selecione uma data</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(date) => {
                                                    field.onChange(date);
                                                    setDateOpen({ ...dateOpen, end: false });
                                                }}
                                                disabled={(date) => date > new Date()}
                                                locale={ptBR}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Carregando..." : "Buscar Transações"}
                </Button>
            </form>
        </Form>
    );
} 