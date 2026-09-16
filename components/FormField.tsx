"use client";

import { useId } from "react";
import {
    Controller,
    type Control,
    type FieldValues,
    type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";

interface FormFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    placeholder?: string;
    type?: "text" | "email" | "password";
}

const FormField = <T extends FieldValues>({
    control,
    name,
    label,
    placeholder,
    type = "text",
}: FormFieldProps<T>) => {
    const id = useId();

    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => (
                <div className="space-y-2">
                    <label htmlFor={id} className="label text-sm font-medium">
                        {label}
                    </label>
                    <Input
                        {...field}
                        id={id}
                        className="input"
                        type={type}
                        placeholder={placeholder}
                        value={field.value ?? ""}
                        aria-invalid={!!fieldState.error}
                        aria-describedby={fieldState.error ? `${id}-error` : undefined}
                    />
                    {fieldState.error && (
                        <p
                            id={`${id}-error`}
                            role="alert"
                            className="text-sm text-destructive-100"
                        >
                            {fieldState.error.message}
                        </p>
                    )}
                </div>
            )}
        />
    );
};

export default FormField;
