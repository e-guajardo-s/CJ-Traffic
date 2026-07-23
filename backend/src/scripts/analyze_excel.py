import pandas as pd
import numpy as np

# Load the detail sheet
df = pd.read_excel('legacy/archivos_prueba/EP_01.xls', sheet_name='Detalle EP', header=4)
# Display the actual progress column
print("Columns:")
print(df.columns)
# Let's see the 'Actual' column
# It has two 'Actual' columns, one for % and one for $
# Columns: 'Item', 'Descripción', 'Un', 'Cantidad', 'P.U ($)', 'Total', 'Acumulado', 'Anterior', 'Actual', 'Acumulado.1', 'Anterior.1', 'Actual.1'
actual_pct = df['Actual']
# filter out non-numeric
actual_pct = pd.to_numeric(actual_pct, errors='coerce')
actual_pct = actual_pct.dropna()
print("Avance Actual % values:")
print(actual_pct.tolist())
print("Mean:", actual_pct.mean())

df2 = pd.read_excel('legacy/archivos_prueba/EP_02.xls', sheet_name='Detalle EP', header=4)
actual_pct2 = pd.to_numeric(df2['Actual'], errors='coerce').dropna()
print("\nEP_02 Avance Actual % values:")
print(actual_pct2.tolist())
print("Mean:", actual_pct2.mean())

